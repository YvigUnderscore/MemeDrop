// Warmup expéditeur (#11) : un envoi trop tôt après la connexion est mis en
// file (statut 'queued') puis diffusé quand le warmup est atteint.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/auth.js';
import { db } from '../src/db.js';
import { dispatchQueuedMemes } from '../src/memeService.js';

const app = createApp();
const admin = request.agent(app);
let channelId;
let deviceToken;

beforeAll(async () => {
  ensureAdmin();
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
  channelId = (await admin.post('/api/channels').send({ name: 'Warmup Test' }).expect(201)).body.id;
  const code = (await admin.post(`/api/channels/${channelId}/devices/pair-code`).send({}).expect(201)).body.code;
  deviceToken = (await request(app).post('/api/client/pair').send({ code, deviceName: 'PC Warmup' }).expect(201)).body.deviceToken;
});

describe('warmup expéditeur', () => {
  it('met en file un envoi quand l\'expéditeur n\'est pas en ligne depuis assez longtemps', async () => {
    const r = await request(app).post('/api/client/meme').set('X-Device-Token', deviceToken)
      .field('text', 'Trop tôt !').expect(201);
    expect(r.body.queued).toBe(true);
    const row = db.prepare('SELECT status FROM memes WHERE id = ?').get(r.body.id);
    expect(row.status).toBe('queued');
  });

  it('diffuse la file une fois le warmup passé (ici : désactivé)', async () => {
    const queued = db.prepare("SELECT id FROM memes WHERE channel_id = ? AND status = 'queued'").all(channelId);
    expect(queued.length).toBeGreaterThan(0);
    // Warmup coupé → le prochain passage du job doit tout diffuser.
    await admin.put(`/api/channels/${channelId}/settings`).send({ senderWarmupS: 0 }).expect(200);
    await dispatchQueuedMemes();
    for (const q of queued) {
      expect(db.prepare('SELECT status FROM memes WHERE id = ?').get(q.id).status).toBe('sent');
    }
  });

  it('envoie immédiatement quand le warmup est désactivé', async () => {
    const r = await request(app).post('/api/client/meme').set('X-Device-Token', deviceToken)
      .field('text', 'Direct !').expect(201);
    expect(r.body.queued).toBeUndefined();
    expect(db.prepare('SELECT status FROM memes WHERE id = ?').get(r.body.id).status).toBe('sent');
  });
});
