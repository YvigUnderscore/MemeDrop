// Test d'intégration du flux Discord OAuth2 (login + link/unlink).
// OAuth est activé en injectant les variables d'env AVANT de charger les modules,
// et les appels réseau vers Discord (échange de code, profil) sont mockés.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

let app;
let db;
const DISCORD_ID = '123456789012345';

// Récupère le paramètre ?state= d'une URL de redirection.
function stateFromLocation(loc) {
  return new URL(loc).searchParams.get('state');
}

beforeAll(async () => {
  vi.stubEnv('DISCORD_CLIENT_ID', 'test_client_id');
  vi.stubEnv('DISCORD_CLIENT_SECRET', 'test_client_secret');
  vi.stubEnv('DISCORD_REDIRECT_URI', 'http://localhost:9999/api/auth/discord/callback');
  vi.resetModules();

  // Mock des appels réseau vers Discord.
  global.fetch = vi.fn(async (url) => {
    const u = String(url);
    if (u.includes('oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'mock_access_token', token_type: 'Bearer' }) };
    }
    if (u.includes('users/@me')) {
      return { ok: true, status: 200, json: async () => ({ id: DISCORD_ID, username: 'coolmec', global_name: 'Cool Mec', avatar: 'abc' }) };
    }
    throw new Error(`fetch non mocké: ${u}`);
  });

  const cfgMod = await import('../src/config.js');
  expect(cfgMod.config.discord.clientId).toBe('test_client_id');
  const authMod = await import('../src/auth.js');
  const appMod = await import('../src/app.js');
  db = (await import('../src/db.js')).db;

  app = appMod.createApp();
  authMod.ensureAdmin();
});

afterAll(() => { vi.unstubAllEnvs(); });

describe('OAuth Discord activé', () => {
  it('status renvoie enabled:true', async () => {
    const r = await request(app).get('/api/auth/discord/status').expect(200);
    expect(r.body.enabled).toBe(true);
  });

  it('login redirige vers discord.com et pose le cookie de nonce', async () => {
    const anon = request.agent(app);
    const r = await anon.get('/api/auth/discord/login').expect(302);
    expect(r.headers.location).toContain('discord.com');
    expect((r.headers['set-cookie'] || []).join(';')).toContain('md_oauth_state');
    expect(stateFromLocation(r.headers.location)).toBeTruthy();
  });

  it('refuse un callback avec un state invalide (anti-CSRF)', async () => {
    const anon = request.agent(app);
    await anon.get('/api/auth/discord/login').expect(302); // pose le nonce
    // state bidon → verifyState échoue
    const r = await anon.get('/api/auth/discord/callback?code=abc&state=faux');
    expect(r.status).toBe(400);
    expect(r.text).toContain('CSRF');
  });

  it('un login sans compte lié est refusé (pas de création auto)', async () => {
    const anon = request.agent(app);
    const start = await anon.get('/api/auth/discord/login').expect(302);
    const state = stateFromLocation(start.headers.location);
    const r = await anon.get(`/api/auth/discord/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(r.status).toBe(400);
    expect(r.text).toContain('No MemeDrop account');
  });

  it('lie un compte Discord à une session panel puis permet le login', async () => {
    // 1. Admin connecté lance le flux de liaison.
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
    const start = await admin.get('/api/auth/discord/login?intent=link').expect(302);
    const state = stateFromLocation(start.headers.location);

    // 2. Callback de liaison (l'agent renvoie md_session + md_oauth_state).
    const cb = await admin.get(`/api/auth/discord/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(cb.status).toBe(200);
    expect(cb.text).toContain('linked');

    // 3. /me reflète la liaison.
    const me = await admin.get('/api/auth/me').expect(200);
    expect(me.body.user.discordId).toBe(DISCORD_ID);

    // 4. Un tout nouvel utilisateur non authentifié se connecte via Discord.
    const anon = request.agent(app);
    const s2 = await anon.get('/api/auth/discord/login').expect(302);
    const state2 = stateFromLocation(s2.headers.location);
    const login = await anon.get(`/api/auth/discord/callback?code=abc&state=${encodeURIComponent(state2)}`);
    expect(login.status).toBe(200);
    expect(login.text).toContain('Welcome');
    // La session est établie : /me renvoie l'admin.
    const me2 = await anon.get('/api/auth/me').expect(200);
    expect(me2.body.user.role).toBe('admin');
    expect(me2.body.user.discordId).toBe(DISCORD_ID);
  });

  it('empêche de lier le même Discord à un second compte', async () => {
    // Crée un second compte et tente de lier le même discord_id (déjà pris par admin).
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
    await admin.post('/api/auth/users').send({ username: 'other', password: 'otherpass123', role: 'moderator' }).expect(201);

    const other = request.agent(app);
    await other.post('/api/auth/login').send({ username: 'other', password: 'otherpass123' }).expect(200);
    const start = await other.get('/api/auth/discord/login?intent=link').expect(302);
    const state = stateFromLocation(start.headers.location);
    const cb = await other.get(`/api/auth/discord/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(cb.status).toBe(400);
    expect(cb.text).toContain('already linked');
  });

  it('délie le compte Discord', async () => {
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
    await admin.post('/api/auth/discord/unlink').expect(200);
    const me = await admin.get('/api/auth/me').expect(200);
    expect(me.body.user.discordId).toBeNull();
  });
});
