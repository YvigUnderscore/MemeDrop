// Éditeur web : le token éditeur (JWT) délivré au panel doit authentifier
// l'éditeur comme un « appareil virtuel » sur /api/client/*, et l'envoi doit
// créer un meme au nom de panel:<user>. Un token invalide/expiré est refusé.
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/auth.js';
import { db } from '../src/db.js';

const app = createApp();
const admin = request.agent(app);
let channelId, channelSlug, editorToken;

beforeAll(async () => {
  ensureAdmin();
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
  const ch = await admin.post('/api/channels').send({ name: 'Éditeur Web' }).expect(201);
  channelId = ch.body.id; channelSlug = ch.body.slug;
});

describe('token éditeur (panel → éditeur web)', () => {
  it('délivre un token éditeur borné au channel', async () => {
    const r = await admin.post(`/api/channels/${channelId}/editor-token`).expect(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.channel.slug).toBe(channelSlug);
    editorToken = r.body.token;
    const payload = jwt.decode(editorToken);
    expect(payload.typ).toBe('editor');
    expect(payload.channelId).toBe(channelId);
    expect(payload.owner).toBe('panel:admin');
  });

  it('exige une session panel (401 sans cookie)', async () => {
    await request(app).post(`/api/channels/${channelId}/editor-token`).expect(401);
  });

  it('authentifie l\'éditeur comme appareil virtuel sur /api/client/config', async () => {
    const r = await request(app).get('/api/client/config').set('X-Device-Token', editorToken).expect(200);
    expect(r.body.channel.slug).toBe(channelSlug);
  });

  it('permet d\'envoyer un meme (sender = panel:admin)', async () => {
    const r = await request(app).post('/api/client/meme')
      .set('X-Device-Token', editorToken)
      .field('text', 'meme depuis éditeur web')
      .field('options', '{}')
      .expect(201);
    expect(r.body.id).toBeTruthy();
    const m = db.prepare('SELECT sender, source, text FROM memes WHERE id = ?').get(r.body.id);
    expect(m.sender).toBe('panel:admin');
    expect(m.source).toBe('editor');
  });

  it('refuse un token éditeur au mauvais format / signature', async () => {
    await request(app).get('/api/client/config').set('X-Device-Token', 'pas.un.jwt').expect(401);
  });

  it('refuse un token éditeur expiré', async () => {
    // Rejoue un JWT editor déjà expiré (signé avec le secret de test).
    const expired = jwt.sign({ typ: 'editor', channelId, owner: 'panel:admin' },
      process.env.JWT_SECRET, { expiresIn: -10 });
    await request(app).get('/api/client/config').set('X-Device-Token', expired).expect(401);
  });

  it('proxy d\'aperçu son : refuse sans auth', async () => {
    await request(app).get('/api/client/sounds/preview?url=https://www.myinstants.com/x.mp3').expect(401);
  });
});
