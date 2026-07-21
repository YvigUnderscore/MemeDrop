// Réglages globaux, guidelines, stats dashboard, journal d'audit, modération.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { db, audit } from '../db.js';
import { config } from '../config.js';
import { isOAuthEnabled } from '../discordOAuth.js';
import { panelAuth, requireAdmin, requireStaff, getSessionEpoch, bumpSessionEpoch } from '../auth.js';
import { getGuidelines, setGuidelines } from '../guidelines.js';
import { getRetentionDays, setRetentionDays, deleteAllMemes } from '../retention.js';
import { channelStats } from '../wsHub.js';
import { signMediaUrl } from '../memeService.js';
import { asyncHandler } from './helpers.js';

const router = Router();
router.use(panelAuth, requireStaff);

// --- Guidelines ---------------------------------------------------------
router.get('/guidelines', (req, res) => res.json({ text: getGuidelines() }));
router.put('/guidelines', requireAdmin, asyncHandler((req, res) => {
  const { text } = z.object({ text: z.string().max(20000) }).parse(req.body);
  setGuidelines(text);
  audit(req.user.username, 'guidelines.update');
  res.json({ ok: true });
}));

// --- Rétention & purge globale ------------------------------------------
router.get('/retention', (req, res) => res.json({ days: getRetentionDays() }));
router.put('/retention', requireAdmin, asyncHandler((req, res) => {
  const { days } = z.object({ days: z.number().int().min(0).max(3650) }).parse(req.body);
  const n = setRetentionDays(days);
  audit(req.user.username, 'retention.set', String(n));
  res.json({ days: n });
}));
router.post('/purge-all', requireAdmin, asyncHandler((req, res) => {
  const n = deleteAllMemes(null);
  audit(req.user.username, 'memes.purge.global', String(n));
  res.json({ deleted: n });
}));

// --- Dashboard ----------------------------------------------------------
router.get('/stats', (req, res) => {
  const online = channelStats();
  const channels = db.prepare('SELECT id, slug, name, active FROM channels ORDER BY id').all().map((c) => ({
    ...c,
    online: online[c.id] || 0,
    memes24h: db.prepare("SELECT COUNT(*) c FROM memes WHERE channel_id = ? AND created_at > ?")
      .get(c.id, Date.now() - 86400000).c,
  }));
  res.json({
    totals: {
      channels: db.prepare('SELECT COUNT(*) c FROM channels').get().c,
      devices: db.prepare('SELECT COUNT(*) c FROM devices WHERE revoked = 0').get().c,
      onlineDevices: Object.values(online).reduce((a, b) => a + b, 0),
      memesTotal: db.prepare('SELECT COUNT(*) c FROM memes').get().c,
      memesBlocked: db.prepare("SELECT COUNT(*) c FROM memes WHERE status = 'blocked'").get().c,
      memesPending: db.prepare("SELECT COUNT(*) c FROM memes WHERE status = 'pending'").get().c,
      openReports: db.prepare('SELECT COUNT(*) c FROM reports WHERE resolved = 0').get().c,
    },
    channels,
  });
});

// --- Journal d'audit ----------------------------------------------------
router.get('/audit', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
  res.json(rows);
});

// --- Infos serveur (page Admin) -----------------------------------------
router.get('/server-info', requireAdmin, (req, res) => {
  let version = '';
  try { version = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version || ''; } catch { /* ignore */ }
  let mediaBytes = 0, mediaFiles = 0;
  try {
    for (const f of fs.readdirSync(config.mediaDir)) {
      try { mediaBytes += fs.statSync(path.join(config.mediaDir, f)).size; mediaFiles++; } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  let dbBytes = 0;
  try { dbBytes = fs.statSync(config.dbPath).size; } catch { /* ignore */ }
  res.json({
    version, node: process.version, env: config.env,
    uptimeS: Math.round(process.uptime()),
    publicUrl: config.publicUrl,
    oauthEnabled: isOAuthEnabled(),
    retention: { days: getRetentionDays() },
    storage: { mediaBytes, mediaFiles, dbBytes },
  });
});

// --- Sécurité : kill-switch (#8) ----------------------------------------
router.get('/security', requireAdmin, (req, res) => {
  res.json({
    activeDevices: db.prepare('SELECT COUNT(*) c FROM devices WHERE revoked = 0').get().c,
    pendingPairings: db.prepare('SELECT COUNT(*) c FROM pairing_codes WHERE used = 0 AND expires_at > ?').get(Date.now()).c,
    sessionEpoch: getSessionEpoch(),
  });
});

// Déconnecte toutes les sessions panel (force une reconnexion partout).
router.post('/security/logout-all', requireAdmin, asyncHandler((req, res) => {
  const epoch = bumpSessionEpoch();
  audit(req.user.username, 'security.logout_all', String(epoch));
  res.json({ ok: true, sessionEpoch: epoch });
}));

// Révoque TOUS les appareils clients (ils devront être ré-appairés).
router.post('/security/revoke-devices', requireAdmin, asyncHandler((req, res) => {
  const info = db.prepare('UPDATE devices SET revoked = 1 WHERE revoked = 0').run();
  audit(req.user.username, 'security.revoke_devices', String(info.changes));
  res.json({ revoked: info.changes });
}));

// Invalide tous les codes d'appairage en attente.
router.post('/security/invalidate-pairing', requireAdmin, asyncHandler((req, res) => {
  const info = db.prepare('UPDATE pairing_codes SET expires_at = 0 WHERE used = 0 AND expires_at > ?').run(Date.now());
  audit(req.user.username, 'security.invalidate_pairing', String(info.changes));
  res.json({ invalidated: info.changes });
}));

// --- File de revue manuelle (moderationMode = 'review') -----------------
router.get('/pending', (req, res) => {
  const rows = db.prepare(`SELECT m.*, c.slug channel_slug, c.name channel_name FROM memes m
      JOIN channels c ON c.id = m.channel_id
      WHERE m.status = 'pending' ORDER BY m.created_at ASC LIMIT 200`).all();
  res.json(rows.map((m) => ({
    ...m,
    targets: JSON.parse(m.targets || '[]'),
    options: JSON.parse(m.options || '{}'),
    mediaUrl: m.media_path ? signMediaUrl(m.media_path) : null,
  })));
});

// --- Signalements / modération ------------------------------------------
router.get('/reports', (req, res) => {
  const rows = db.prepare(`SELECT r.*, c.slug channel_slug FROM reports r
      JOIN channels c ON c.id = r.channel_id
      ORDER BY r.resolved ASC, r.created_at DESC LIMIT 200`).all();
  res.json(rows);
});

router.post('/reports/:id/resolve', asyncHandler((req, res) => {
  const row = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE reports SET resolved = 1 WHERE id = ?').run(row.id);
  audit(req.user.username, 'report.resolve', { id: row.id });
  res.json({ ok: true });
}));

export default router;
