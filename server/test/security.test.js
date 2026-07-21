// Tests des correctifs de sécurité de ce round : garde CSRF (Origin),
// réglages de channel réservés aux admins, état OAuth désactivé, et
// unité du module discordOAuth (state anti-CSRF).
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ensureAdmin } from '../src/auth.js';
import { createState, verifyState, buildAuthorizeUrl, isOAuthEnabled } from '../src/discordOAuth.js';

const app = createApp();
const admin = request.agent(app);
let channelId;

beforeAll(async () => {
  ensureAdmin();
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
  const ch = await admin.post('/api/channels').send({ name: 'Sec Test' }).expect(201);
  channelId = ch.body.id;
});

describe('garde CSRF (vérification Origin)', () => {
  it('refuse une mutation avec une Origin cross-site', async () => {
    await request(app).post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ username: 'admin', password: 'adminpass123' })
      .expect(403);
  });

  it('refuse aussi via un Referer cross-site', async () => {
    await request(app).post('/api/auth/login')
      .set('Referer', 'https://evil.example/attaque.html')
      .send({ username: 'admin', password: 'adminpass123' })
      .expect(403);
  });

  it('autorise une mutation same-origin (Origin = Host)', async () => {
    // Origin correspondant au Host de la requête → passe le garde (puis 401 sur creds).
    await request(app).post('/api/auth/login')
      .set('Origin', 'http://127.0.0.1')
      .set('Host', '127.0.0.1')
      .send({ username: 'admin', password: 'mauvais' })
      .expect(401);
  });

  it('autorise une requête sans Origin (client non-navigateur)', async () => {
    await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: 'mauvais' })
      .expect(401);
  });
});

describe('réglages de channel réservés aux admins', () => {
  let mod;
  beforeAll(async () => {
    await admin.post('/api/auth/users').send({ username: 'modsec', password: 'modpass123', role: 'moderator' }).expect(201);
    mod = request.agent(app);
    await mod.post('/api/auth/login').send({ username: 'modsec', password: 'modpass123' }).expect(200);
  });

  it('un modérateur ne peut PAS modifier les réglages (mode de modération)', async () => {
    await mod.put(`/api/channels/${channelId}/settings`).send({ moderationMode: 'off' }).expect(403);
  });

  it('un admin le peut', async () => {
    const r = await admin.put(`/api/channels/${channelId}/settings`).send({ moderationMode: 'filter' }).expect(200);
    expect(r.body.moderationMode).toBe('filter');
  });
});

describe('OAuth Discord désactivé (env de test sans client)', () => {
  it('status renvoie enabled:false', async () => {
    const r = await request(app).get('/api/auth/discord/status').expect(200);
    expect(r.body.enabled).toBe(false);
    expect(isOAuthEnabled()).toBe(false);
  });
  it('login renvoie 404 quand non configuré', async () => {
    await request(app).get('/api/auth/discord/login').expect(404);
  });
  it('callback renvoie 404 quand non configuré', async () => {
    await request(app).get('/api/auth/discord/callback?code=x&state=y').expect(404);
  });
});

describe('module discordOAuth : state anti-CSRF', () => {
  it('valide un state signé avec le bon nonce', () => {
    const { nonce, state } = createState({ intent: 'login' });
    const parsed = verifyState(state, nonce);
    expect(parsed).toEqual({ intent: 'login', userId: null });
  });
  it('rejette un state avec un mauvais nonce', () => {
    const { state } = createState({ intent: 'link', userId: 7 });
    expect(verifyState(state, 'mauvais_nonce')).toBeNull();
  });
  it('rejette un state absent ou falsifié', () => {
    expect(verifyState('', 'x')).toBeNull();
    expect(verifyState('pas.un.jwt', 'x')).toBeNull();
  });
  it('construit une URL d\'autorisation avec les bons paramètres', () => {
    const url = buildAuthorizeUrl('STATE123');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=identify');
    expect(url).toContain('state=STATE123');
  });
});
