// ============================================================
//  Routeur côté client desktop (device-facing).
//  Appairage, config+features, envoi (media/overlay/son), bibliothèque
//  d'assets (quota), réglages partagés, planification.
// ============================================================

import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db, now, audit, getChannelSettings } from '../db.js';
import { config } from '../config.js';
import { deviceAuth } from '../auth.js';
import { hashToken, randomToken } from '../crypto.js';
import { getChannelGuidelines } from '../guidelines.js';
import { effectiveFeatures } from '../features.js';
import { processMedia, HttpError } from '../media.js';
import { createAndDispatchMeme, signMediaUrl } from '../memeService.js';
import { createSchedule } from '../scheduler.js';
import { removeMediaFile } from '../retention.js';
import { pushPanel, invalidateBlocks } from '../wsHub.js';
import { searchMyInstants, downloadMyInstants } from '../sounds.js';
import { giphyEnabled, searchGiphy, fetchRemoteMedia } from '../webmedia.js';
import { asyncHandler } from './helpers.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 10 } });
const memeFields = upload.fields([
  { name: 'media', maxCount: 1 }, { name: 'overlay', maxCount: 1 }, { name: 'sound', maxCount: 1 },
  { name: 'layers', maxCount: 6 }, // composition multi-calques (fond + vidéos/gifs)
]);

// Propriétaire logique : appareil virtuel (éditeur panel) → owner explicite ;
// sinon compte Discord lié, sinon l'appareil lui-même.
const ownerOf = (device) => device.owner || device.discord_id || `device:${device.id}`;
const parseJSON = (v, d) => { try { return v ? JSON.parse(v) : d; } catch { return d; } };

// Référence le son déjà transcodé d'un asset de la bibliothèque (#13), si l'assetId
// appartient bien au device courant. On le copie tel quel (pas de re-transcodage),
// ce qui évite aussi la mauvaise détection d'un m4a audio comme "video/mp4".
function assetSoundInfo(device, assetId) {
  if (!assetId) return null;
  // Le son peut appartenir à l'appareil (bibliothèque perso) OU au channel
  // (soundboard partagé #4). Dans les deux cas il est déjà transcodé.
  const a = db.prepare("SELECT media_path, media_mime FROM assets WHERE id = ? AND channel_id = ? AND owner IN (?, 'channel') AND kind = 'sound'")
    .get(String(assetId), device.channel_id, ownerOf(device));
  if (!a || !a.media_path) return null;
  if (!fs.existsSync(path.join(config.mediaDir, path.basename(a.media_path)))) return null;
  return { relPath: a.media_path, mime: a.media_mime };
}

function clientConfigFor(channel, device) {
  const s = getChannelSettings(channel);
  return {
    channel: { slug: channel.slug, name: channel.name },
    device: { id: device.id, name: device.name, discordId: device.discord_id || '' },
    wsUrl: config.publicUrl.replace(/^http/, 'ws') + '/ws',
    guidelines: getChannelGuidelines(channel),
    features: effectiveFeatures(channel, ownerOf(device)),
    limits: { storageQuotaMb: s.storageQuotaMb, maxSchedulesPerUser: s.maxSchedulesPerUser },
    settings: {
      defaultCooldownS: s.defaultCooldownS, defaultVolume: s.defaultVolume, defaultOpacity: s.defaultOpacity,
      maxImageDurationS: s.maxImageDurationS, maxGifDurationS: s.maxGifDurationS,
      maxVideoDurationS: s.maxVideoDurationS, maxAudioDurationS: s.maxAudioDurationS,
      maxTextLength: s.maxTextLength, allowedTypes: s.allowedTypes, allowEditorSend: s.allowEditorSend,
      requireGuidelinesAccept: s.requireGuidelinesAccept, maxUploadMb: s.maxUploadMb,
      sharedSoundboard: s.sharedSoundboard !== false,
      maxAnimMs: s.maxAnimMs || 1500,
      giphyEnabled: giphyEnabled(),
    },
  };
}

function channelOf(req) {
  const c = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.device.channel_id);
  if (!c) throw new HttpError(404, 'Channel not found');
  return c;
}

// --- Appairage ----------------------------------------------------------
router.post('/pair', asyncHandler((req, res) => {
  const { code, deviceName } = z.object({
    code: z.string().min(4).max(20),
    deviceName: z.string().max(60).optional().default('Appareil'),
  }).parse(req.body);
  const pc = db.prepare('SELECT * FROM pairing_codes WHERE code = ?').get(code.toUpperCase().trim());
  if (!pc || pc.used || pc.expires_at < now()) return res.status(400).json({ error: 'Invalid or expired code.' });
  const channel = db.prepare('SELECT * FROM channels WHERE id = ? AND active = 1').get(pc.channel_id);
  if (!channel) return res.status(404).json({ error: 'Channel not found or disabled.' });

  const token = randomToken(32);
  const info = db.prepare(`INSERT INTO devices (channel_id, name, token_hash, discord_id, last_seen, created_at)
      VALUES (?,?,?,?,?,?)`).run(channel.id, deviceName, hashToken(token), pc.discord_id || '', now(), now());
  db.prepare('UPDATE pairing_codes SET used = 1 WHERE code = ?').run(pc.code);
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(info.lastInsertRowid);
  audit(deviceName, 'device.paired', { channel: channel.slug, device: device.id });
  res.status(201).json({ deviceToken: token, ...clientConfigFor(channel, device) });
}));

router.get('/config', deviceAuth, asyncHandler((req, res) => res.json(clientConfigFor(channelOf(req), req.device))));

router.get('/targets', deviceAuth, (req, res) => {
  const cid = req.device.channel_id;
  const groups = db.prepare('SELECT name, members FROM mention_groups WHERE channel_id = ? ORDER BY name').all(cid)
    .map((g) => ({ name: g.name, count: parseJSON(g.members, []).length }));
  const members = db.prepare('SELECT discord_id, discord_username FROM whitelist WHERE channel_id = ? AND banned = 0 ORDER BY discord_username').all(cid)
    .map((m) => ({ discordId: m.discord_id, username: m.discord_username || m.discord_id }));
  res.json({ groups, members });
});

// --- Envoi (media + overlay + son) --------------------------------------
router.post('/meme', deviceAuth, memeFields, asyncHandler(async (req, res) => {
  const channel = channelOf(req);
  const f = req.files || {};
  const result = await createAndDispatchMeme({
    channel, source: 'editor', sender: ownerOf(req.device), senderName: req.device.name,
    discordId: req.device.discord_id || '',
    text: req.body.text || '',
    mediaBuffer: f.media?.[0]?.buffer || null,
    overlayBuffer: f.overlay?.[0]?.buffer || null,
    soundBuffer: f.sound?.[0]?.buffer || null,
    layerBuffers: (f.layers || []).map((x) => x.buffer),
    comp: parseJSON(req.body.comp, null),
    soundAsset: assetSoundInfo(req.device, req.body.soundAssetId),
    groupNames: parseJSON(req.body.groups, []).map(String),
    mentions: parseJSON(req.body.mentions, []).map(String),
    options: parseJSON(req.body.options, {}),
  });
  res.status(201).json(result);
}));

router.post('/report', deviceAuth, asyncHandler((req, res) => {
  const { memeId, reason } = z.object({
    memeId: z.string().max(40).optional().default(''), reason: z.string().max(500).optional().default(''),
  }).parse(req.body);
  db.prepare('INSERT INTO reports (meme_id, channel_id, reporter, reason, created_at) VALUES (?,?,?,?,?)')
    .run(memeId || null, req.device.channel_id, req.device.name, reason, now());
  pushPanel('report.new', { channelId: req.device.channel_id, reporter: req.device.name, reason });
  res.status(201).json({ ok: true });
}));

// --- Blocages personnels (#15) : masquer les memes d'un expéditeur ------
router.get('/blocks', deviceAuth, (req, res) => {
  const rows = db.prepare('SELECT blocked_id, blocked_name, created_at FROM member_blocks WHERE channel_id = ? AND owner = ? ORDER BY created_at DESC')
    .all(req.device.channel_id, ownerOf(req.device));
  res.json(rows.map((r) => ({ senderId: r.blocked_id, name: r.blocked_name, createdAt: r.created_at })));
});

router.post('/blocks', deviceAuth, asyncHandler((req, res) => {
  const { senderId, name } = z.object({
    senderId: z.string().min(1).max(80), name: z.string().max(80).optional().default(''),
  }).parse(req.body);
  db.prepare(`INSERT INTO member_blocks (channel_id, owner, blocked_id, blocked_name, created_at)
      VALUES (?,?,?,?,?) ON CONFLICT(channel_id, owner, blocked_id) DO UPDATE SET blocked_name = excluded.blocked_name`)
    .run(req.device.channel_id, ownerOf(req.device), senderId, name, now());
  invalidateBlocks(req.device.channel_id);
  res.status(201).json({ ok: true });
}));

router.delete('/blocks/:senderId', deviceAuth, (req, res) => {
  db.prepare('DELETE FROM member_blocks WHERE channel_id = ? AND owner = ? AND blocked_id = ?')
    .run(req.device.channel_id, ownerOf(req.device), req.params.senderId);
  invalidateBlocks(req.device.channel_id);
  res.json({ ok: true });
});

// --- GIFs Giphy + import d'un média par URL ------------------------------
router.get('/gifs/search', deviceAuth, asyncHandler(async (req, res) => {
  const q = z.object({ q: z.string().max(100).optional().default('') }).parse(req.query).q;
  if (!giphyEnabled()) return res.json({ enabled: false, results: [] });
  res.json({ enabled: true, results: q ? await searchGiphy(q) : [] });
}));

// Coller un lien d'image/GIF/vidéo dans l'éditeur : le serveur le télécharge
// (anti-SSRF, cf. webmedia.js) et renvoie le binaire — le contenu repassera
// par processMedia à l'envoi, comme n'importe quel fichier local.
router.post('/media/from-url', deviceAuth, asyncHandler(async (req, res) => {
  const { url } = z.object({ url: z.string().url().max(600) }).parse(req.body);
  const s = getChannelSettings(channelOf(req));
  const { buffer, mime } = await fetchRemoteMedia(url, (s.maxUploadMb || 25) * 1048576);
  res.setHeader('Content-Type', mime);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(buffer);
}));

// --- Soundboard myinstants (#13) : recherche + import -------------------
router.get('/sounds/search', deviceAuth, asyncHandler(async (req, res) => {
  const q = z.object({ q: z.string().max(80).optional().default('') }).parse(req.query).q;
  res.json(await searchMyInstants(q));
}));

// Aperçu d'un son myinstants (proxy SSRF-guardé) — remplace l'IPC Electron `sounds:preview`
// pour l'éditeur web (le navigateur ne peut pas charger le mp3 cross-origin sous CSP).
router.get('/sounds/preview', deviceAuth, asyncHandler(async (req, res) => {
  const url = z.object({ url: z.string().url() }).parse(req.query).url;
  const buffer = await downloadMyInstants(url);           // valide l'hôte + plafonne la taille
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'private, max-age=600');
  res.send(buffer);
}));

router.post('/sounds/import', deviceAuth, asyncHandler(async (req, res) => {
  const { url, name } = z.object({ url: z.string().url(), name: z.string().max(80).optional().default('') }).parse(req.body);
  const channel = channelOf(req);
  const s = getChannelSettings(channel);
  const owner = ownerOf(req.device);
  const buffer = await downloadMyInstants(url);
  const media = await processMedia(buffer, { ...s, allowedTypes: ['audio'] });
  if ((usedBytes(channel.id, owner) + (media.size || 0)) > s.storageQuotaMb * 1048576) {
    removeMediaFile(media.relPath);
    throw new HttpError(413, `Storage quota exceeded (${s.storageQuotaMb} MB).`);
  }
  const id = nanoid(14);
  db.prepare(`INSERT INTO assets (id, channel_id, owner, owner_name, kind, name, media_path, media_mime, media_size, data, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, channel.id, owner, req.device.name, 'sound', (name || 'Son myinstants').slice(0, 80),
      media.relPath, media.mime, media.size || 0, JSON.stringify({ source: 'myinstants', url }), now());
  res.status(201).json({ id, sizeMb: +((media.size || 0) / 1048576).toFixed(2) });
}));

// --- Bibliothèque (sons / memes) + quota --------------------------------
function usedBytes(channelId, owner) {
  return db.prepare('SELECT COALESCE(SUM(media_size),0) s FROM assets WHERE channel_id = ? AND owner = ?').get(channelId, owner).s;
}

router.get('/storage', deviceAuth, (req, res) => {
  const s = getChannelSettings(channelOf(req));
  res.json({ usedMb: +(usedBytes(req.device.channel_id, ownerOf(req.device)) / 1048576).toFixed(2), quotaMb: s.storageQuotaMb });
});

router.get('/assets', deviceAuth, (req, res) => {
  const kind = ['sound', 'meme'].includes(req.query.kind) ? req.query.kind : null;
  const rows = db.prepare(`SELECT * FROM assets WHERE channel_id = @cid AND owner = @owner ${kind ? 'AND kind = @kind' : ''} ORDER BY created_at DESC`)
    .all({ cid: req.device.channel_id, owner: ownerOf(req.device), kind });
  res.json(rows.map((a) => ({
    id: a.id, kind: a.kind, name: a.name, sizeMb: +(a.media_size / 1048576).toFixed(2),
    url: a.media_path ? signMediaUrl(a.media_path) : null, mime: a.media_mime,
    data: parseJSON(a.data, {}), createdAt: a.created_at,
  })));
});

router.post('/assets', deviceAuth, upload.single('media'), asyncHandler(async (req, res) => {
  const channel = channelOf(req);
  const s = getChannelSettings(channel);
  const owner = ownerOf(req.device);
  const kind = ['sound', 'meme'].includes(req.body.kind) ? req.body.kind : 'sound';
  let media = null;
  if (req.file?.buffer) {
    const allowed = kind === 'sound' ? ['audio'] : ['image', 'gif', 'video', 'audio'];
    media = await processMedia(req.file.buffer, { ...s, allowedTypes: allowed });
  }
  const addSize = media?.size || 0;
  if ((usedBytes(channel.id, owner) + addSize) > s.storageQuotaMb * 1048576) {
    throw new HttpError(413, `Storage quota exceeded (${s.storageQuotaMb} MB).`);
  }
  const id = nanoid(14);
  db.prepare(`INSERT INTO assets (id, channel_id, owner, owner_name, kind, name, media_path, media_mime, media_size, data, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, channel.id, owner, req.device.name, kind, (req.body.name || 'Sans nom').slice(0, 80),
      media?.relPath || null, media?.mime || null, addSize, JSON.stringify(parseJSON(req.body.data, {})), now());
  res.status(201).json({ id });
}));

// Métadonnées d'un asset (#9) : favori / catégorie / renommage.
router.patch('/assets/:id', deviceAuth, asyncHandler((req, res) => {
  const row = db.prepare('SELECT * FROM assets WHERE id = ? AND channel_id = ? AND owner = ?')
    .get(req.params.id, req.device.channel_id, ownerOf(req.device));
  if (!row) return res.status(404).json({ error: 'Not found' });
  const body = z.object({
    name: z.string().max(80).optional(),
    favorite: z.boolean().optional(),
    category: z.string().max(40).optional(),
  }).parse(req.body || {});
  let data = parseJSON(row.data, {});
  if (body.favorite !== undefined) data.favorite = body.favorite;
  if (body.category !== undefined) data.category = body.category;
  const name = body.name !== undefined ? body.name : row.name;
  db.prepare('UPDATE assets SET name = ?, data = ? WHERE id = ?').run(name, JSON.stringify(data), row.id);
  res.json({ ok: true });
}));

router.delete('/assets/:id', deviceAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM assets WHERE id = ? AND channel_id = ? AND owner = ?')
    .get(req.params.id, req.device.channel_id, ownerOf(req.device));
  if (row) {
    removeMediaFile(row.media_path);
    db.prepare('DELETE FROM assets WHERE id = ?').run(row.id);
  }
  res.json({ ok: true });
});

// --- Soundboard partagé du channel (#4) : lecture seule côté client -------
router.get('/soundboard', deviceAuth, asyncHandler((req, res) => {
  const channel = channelOf(req);
  const s = getChannelSettings(channel);
  if (s.sharedSoundboard === false) return res.json([]);
  const rows = db.prepare("SELECT * FROM assets WHERE channel_id = ? AND owner = 'channel' AND kind = 'sound' ORDER BY created_at DESC")
    .all(channel.id);
  res.json(rows.map((a) => ({
    id: a.id, name: a.name, sizeMb: +((a.media_size || 0) / 1048576).toFixed(2),
    url: a.media_path ? signMediaUrl(a.media_path) : null, mime: a.media_mime,
    data: parseJSON(a.data, {}), createdAt: a.created_at, shared: true,
  })));
}));

// --- Réglages partagés (voir les préférences des autres) ----------------
router.post('/my-settings', deviceAuth, asyncHandler((req, res) => {
  const did = req.device.discord_id;
  if (!did) return res.json({ ok: false, reason: 'device non lié à un compte Discord' });
  const settings = JSON.stringify(parseJSON(JSON.stringify(req.body?.settings || {}), {}));
  db.prepare(`INSERT INTO member_settings (channel_id, discord_id, name, settings, updated_at)
      VALUES (?,?,?,?,?) ON CONFLICT(channel_id, discord_id) DO UPDATE SET name=excluded.name, settings=excluded.settings, updated_at=excluded.updated_at`)
    .run(req.device.channel_id, did, req.device.name, settings, now());
  res.json({ ok: true });
}));

router.get('/members-settings', deviceAuth, asyncHandler((req, res) => {
  const channel = channelOf(req);
  const flags = effectiveFeatures(channel, ownerOf(req.device));
  if (flags.shareSettings === false) return res.json([]);
  const rows = db.prepare('SELECT discord_id, name, settings, updated_at FROM member_settings WHERE channel_id = ? ORDER BY updated_at DESC')
    .all(channel.id);
  res.json(rows.map((r) => ({ discordId: r.discord_id, name: r.name, settings: parseJSON(r.settings, {}), updatedAt: r.updated_at })));
}));

// --- Planification ------------------------------------------------------
router.get('/schedules', deviceAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM schedules WHERE channel_id = ? AND owner = ? ORDER BY created_at DESC')
    .all(req.device.channel_id, ownerOf(req.device));
  res.json(rows.map((r) => ({
    id: r.id, label: r.label, text: r.text, triggerType: r.trigger_type, triggerAt: r.trigger_at,
    triggerDays: parseJSON(r.trigger_days, []), triggerTime: r.trigger_time, nextRun: r.next_run,
    active: !!r.active, hasMedia: !!r.media_path, targets: parseJSON(r.targets, []),
  })));
});

router.post('/schedules', deviceAuth, memeFields, asyncHandler(async (req, res) => {
  const channel = channelOf(req);
  const f = req.files || {};
  const result = await createSchedule({
    channel, device: req.device, owner: ownerOf(req.device),
    label: req.body.label || '',
    text: req.body.text || '',
    mediaBuffer: f.media?.[0]?.buffer || null,
    overlayBuffer: f.overlay?.[0]?.buffer || null,
    soundBuffer: f.sound?.[0]?.buffer || null,
    layerBuffers: (f.layers || []).map((x) => x.buffer),
    comp: parseJSON(req.body.comp, null),
    soundAsset: assetSoundInfo(req.device, req.body.soundAssetId),
    options: parseJSON(req.body.options, {}),
    groupNames: parseJSON(req.body.groups, []).map(String),
    mentions: parseJSON(req.body.mentions, []).map(String),
    trigger: parseJSON(req.body.trigger, {}),
  });
  res.status(201).json(result);
}));

router.delete('/schedules/:id', deviceAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM schedules WHERE id = ? AND channel_id = ? AND owner = ?')
    .get(req.params.id, req.device.channel_id, ownerOf(req.device));
  if (row) {
    // Le média a déjà été transcodé et écrit sur disque à la création (options.__prepared) :
    // s'il n'a jamais été diffusé, il n'est référencé par aucun meme et doit être nettoyé ici.
    removeMediaFile(row.media_path);
    removeMediaFile(row.sound_path);
    const options = parseJSON(row.options, {});
    if (options.overlayPath) removeMediaFile(options.overlayPath);
    db.prepare('DELETE FROM schedules WHERE id = ?').run(row.id);
  }
  res.json({ ok: true });
});

export default router;
