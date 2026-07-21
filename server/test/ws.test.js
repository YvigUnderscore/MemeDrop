// Test d'intégration WebSocket : résolution de cible des réactions (#3),
// validation "device a reçu le meme", et effets de seuil (#7).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { WebSocket } from 'ws';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/auth.js';
import { initWebSocket } from '../src/wsHub.js';
import { db } from '../src/db.js';
import { createAndDispatchMeme } from '../src/memeService.js';

const app = createApp();
const admin = request.agent(app);
let server, port, channelId, deviceToken;

function connectWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(deviceToken)}`);
    ws._msgs = [];
    ws.on('message', (raw) => { try { ws._msgs.push(JSON.parse(raw.toString())); } catch { /* ignore */ } });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForType(ws, type, timeout = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const m = ws._msgs.find((x) => x.type === type);
    if (m) return m;
    await wait(30);
  }
  return null;
}

beforeAll(async () => {
  ensureAdmin();
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
  const ch = await admin.post('/api/channels').send({ name: 'WS Test' }).expect(201);
  channelId = ch.body.id;
  // Seuil de milestone à 1 pour déclencher facilement.
  await admin.put(`/api/channels/${channelId}/settings`).send({ reactionMilestones: [1] }).expect(200);
  const code = (await admin.post(`/api/channels/${channelId}/devices/pair-code`).send({}).expect(201)).body.code;
  const pair = await request(app).post('/api/client/pair').send({ code, deviceName: 'WS PC' }).expect(201);
  deviceToken = pair.body.deviceToken;

  server = http.createServer(app);
  initWebSocket(server);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});

afterAll(() => { try { server.close(); } catch { /* ignore */ } });

describe('réactions via WebSocket', () => {
  it('enregistre une réaction sur un meme réellement reçu et déclenche un milestone', async () => {
    const ws = await connectWs();
    await waitForType(ws, 'hello');

    // Diffuse un meme à tout le channel (le device le reçoit).
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    const r = await createAndDispatchMeme({ channel, source: 'panel', sender: 'panel:admin', senderName: 'admin', text: 'réagis-moi', isModerator: true });
    const memeMsg = await waitForType(ws, 'meme');
    expect(memeMsg?.meme?.id).toBe(r.id);

    // Le device confirme l'affichage puis réagit.
    ws.send(JSON.stringify({ type: 'ack', memeId: r.id, status: 'displayed' }));
    await wait(100);
    ws.send(JSON.stringify({ type: 'reaction', memeId: r.id, emoji: '🔥' }));

    // Milestone (seuil 1) diffusé à tout le channel.
    const ms = await waitForType(ws, 'milestone');
    expect(ms?.memeId).toBe(r.id);
    expect(ms?.threshold).toBe(1);

    await wait(100);
    const count = db.prepare('SELECT COUNT(*) c FROM meme_reactions WHERE meme_id = ? AND emoji = ?').get(r.id, '🔥').c;
    expect(count).toBe(1);
    ws.close();
  });

  it('ignore une réaction sur un meme jamais reçu par le device', async () => {
    const ws = await connectWs();
    await waitForType(ws, 'hello');
    // Un meme ciblé sur quelqu'un d'autre (pas ce device) → pas reçu.
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    // Insère un meme ciblé sur un discord_id fictif, jamais diffusé à ce device.
    const id = 'unseen_' + Date.now();
    db.prepare(`INSERT INTO memes (id, channel_id, sender, sender_name, source, type, text, targets, options, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, channelId, 'panel:admin', 'admin', 'panel', 'text', 'secret', JSON.stringify(['555000111222']), '{}', 'sent', Date.now());

    ws.send(JSON.stringify({ type: 'reaction', memeId: id, emoji: '🔥' }));
    await wait(200);
    const count = db.prepare('SELECT COUNT(*) c FROM meme_reactions WHERE meme_id = ?').get(id).c;
    expect(count).toBe(0);
    ws.close();
  });
});
