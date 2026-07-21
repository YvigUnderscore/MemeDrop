// Tests du round 2 : Hall of Memes, profil de membre (#10),
// soundboard partagé (#4), métadonnées d'assets favoris/catégories (#9).
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { nanoid } from 'nanoid';
import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/auth.js';
import { db, now } from '../src/db.js';

const app = createApp();
const admin = request.agent(app);

let channelId;
let deviceToken;
let deviceId;
const memeIds = [];

function insertMeme(sender, senderName, text, status = 'sent') {
  const id = nanoid(12);
  db.prepare(`INSERT INTO memes (id, channel_id, sender, sender_name, source, type, text, targets, options, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, channelId, sender, senderName, 'panel', 'text', text, '[]', '{}', status, now());
  return id;
}
function insertReaction(memeId, deviceIdV, discordId, emoji) {
  db.prepare(`INSERT INTO meme_reactions (meme_id, channel_id, device_id, discord_id, name, emoji, created_at)
      VALUES (?,?,?,?,?,?,?)`).run(memeId, channelId, deviceIdV, discordId, 'X', emoji, now());
}

beforeAll(async () => {
  ensureAdmin();
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
  const ch = await admin.post('/api/channels').send({ name: 'Round2' }).expect(201);
  channelId = ch.body.id;
  await admin.post(`/api/channels/${channelId}/whitelist`).send({ discordId: '111111111111', discordUsername: 'Alice' }).expect(201);

  // Appaire un appareil (non lié à un compte Discord → owner device:<id>).
  const code = (await admin.post(`/api/channels/${channelId}/devices/pair-code`).send({}).expect(201)).body.code;
  const pair = await request(app).post('/api/client/pair').send({ code, deviceName: 'PC Test' }).expect(201);
  deviceToken = pair.body.deviceToken;
  deviceId = pair.body.device.id;

  // 3 memes du membre 111 (compte Discord), avec des nombres de réactions décroissants.
  const m1 = insertMeme('111111111111', 'Alice', 'meme populaire');
  const m2 = insertMeme('111111111111', 'Alice', 'meme moyen');
  const m3 = insertMeme('111111111111', 'Alice', 'meme discret');
  memeIds.push(m1, m2, m3);
  // m1 : 3 réactions (2x🔥, 1x😂) ; m2 : 2 (😂) ; m3 : 1 (💀)
  insertReaction(m1, 1, '999', '🔥');
  insertReaction(m1, 2, '888', '🔥');
  insertReaction(m1, 3, '777', '😂');
  insertReaction(m2, 1, '999', '😂');
  insertReaction(m2, 2, '888', '😂');
  insertReaction(m3, 1, '999', '💀');
  // Un affichage confirmé d'un meme d'Alice.
  db.prepare(`INSERT INTO meme_receipts (meme_id, channel_id, device_id, discord_id, name, status, created_at)
      VALUES (?,?,?,?,?,?,?)`).run(m1, channelId, 5, '999', 'Bob', 'displayed', now());
});

describe('Hall of Memes', () => {
  it('classe les memes par nombre de réactions', async () => {
    const r = await admin.get(`/api/channels/${channelId}/hall?days=30`).expect(200);
    expect(r.body.memes.length).toBe(3);
    expect(r.body.memes[0].text).toBe('meme populaire');
    expect(r.body.memes[0].count).toBe(3);
    expect(r.body.memes[0].reactions['🔥']).toBe(2);
  });

  it('filtre par type de réaction (emoji)', async () => {
    const r = await admin.get(`/api/channels/${channelId}/hall?days=30&emoji=${encodeURIComponent('😂')}`).expect(200);
    // m2 a 2x😂, m1 a 1x😂 → m2 en tête.
    expect(r.body.emoji).toBe('😂');
    expect(r.body.memes[0].text).toBe('meme moyen');
    expect(r.body.memes[0].count).toBe(2);
    // m3 (💀 uniquement) n'apparaît pas.
    expect(r.body.memes.some((m) => m.text === 'meme discret')).toBe(false);
  });
});

describe('Profil de membre (#10)', () => {
  it('agrège stats, galerie, réactions reçues, appareils', async () => {
    const r = await admin.get(`/api/channels/${channelId}/members/111111111111/profile`).expect(200);
    expect(r.body.member.discord_username).toBe('Alice');
    expect(r.body.stats.sent).toBe(3);
    expect(r.body.stats.reactionsReceived).toBe(6);
    expect(r.body.stats.displays).toBe(1);
    expect(r.body.gallery.length).toBe(3);
    expect(r.body.reactionsBreakdown['🔥']).toBe(2);
    expect(r.body.reactionsBreakdown['😂']).toBe(3);
  });
});

describe('Soundboard partagé (#4)', () => {
  let soundId;
  beforeAll(() => {
    // Insère un son partagé directement (évite ffmpeg dans les tests).
    soundId = nanoid(14);
    db.prepare(`INSERT INTO assets (id, channel_id, owner, owner_name, kind, name, media_path, media_mime, media_size, data, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(soundId, channelId, 'channel', 'admin', 'sound', 'Air horn', 'shared.m4a', 'audio/mp4', 12345,
        JSON.stringify({ category: 'Memes' }), now());
  });

  it('le panel liste les sons partagés', async () => {
    const r = await admin.get(`/api/channels/${channelId}/soundboard`).expect(200);
    expect(r.body.some((s) => s.name === 'Air horn' && s.data.category === 'Memes')).toBe(true);
  });

  it('le client liste aussi les sons partagés', async () => {
    const r = await request(app).get('/api/client/soundboard').set('X-Device-Token', deviceToken).expect(200);
    expect(r.body.some((s) => s.shared && s.name === 'Air horn')).toBe(true);
  });

  it('le panel renomme / re-catégorise', async () => {
    await admin.patch(`/api/channels/${channelId}/soundboard/${soundId}`).send({ name: 'Klaxon', category: 'FX' }).expect(200);
    const r = await admin.get(`/api/channels/${channelId}/soundboard`).expect(200);
    const s = r.body.find((x) => x.id === soundId);
    expect(s.name).toBe('Klaxon');
    expect(s.data.category).toBe('FX');
  });
});

describe('Métadonnées d\'assets favoris/catégories (#9)', () => {
  let assetId;
  beforeAll(() => {
    assetId = nanoid(14);
    db.prepare(`INSERT INTO assets (id, channel_id, owner, owner_name, kind, name, media_path, media_mime, media_size, data, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(assetId, channelId, `device:${deviceId}`, 'PC Test', 'sound', 'Mon son', 'perso.m4a', 'audio/mp4', 5000, '{}', now());
  });

  it('marque un son en favori et lui donne une catégorie', async () => {
    await request(app).patch(`/api/client/assets/${assetId}`).set('X-Device-Token', deviceToken)
      .send({ favorite: true, category: 'Préférés' }).expect(200);
    const r = await request(app).get('/api/client/assets?kind=sound').set('X-Device-Token', deviceToken).expect(200);
    const a = r.body.find((x) => x.id === assetId);
    expect(a.data.favorite).toBe(true);
    expect(a.data.category).toBe('Préférés');
  });

  it('refuse de modifier un asset d\'un autre propriétaire', async () => {
    await request(app).patch('/api/client/assets/inexistant').set('X-Device-Token', deviceToken)
      .send({ favorite: true }).expect(404);
  });
});
