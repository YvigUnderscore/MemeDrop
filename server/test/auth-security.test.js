// ============================================================
//  Non-régression des correctifs d'authentification.
//  Chaque test correspond à une faille constatée et corrigée : s'il repasse
//  au rouge, c'est que la protection a sauté.
// ============================================================
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { ensureAdmin, issueEditorToken, verifySessionUser, getSessionEpoch } from '../src/auth.js';
import { config } from '../src/config.js';
import { db } from '../src/db.js';

const app = createApp();
const ADMIN_PW = 'adminpass123';

beforeAll(() => { ensureAdmin(); });

// Mesure le temps de réponse médian d'une tentative de connexion.
async function loginMedian(username, runs = 5) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t0 = process.hrtime.bigint();
    await request(app).post('/api/auth/login').send({ username, password: `mauvais-${i}` });
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)];
}

describe('énumération de comptes par temps de réponse', () => {
  it('un compte inexistant coûte le même temps qu\'un compte réel', async () => {
    const existant = await loginMedian('admin');
    const inexistant = await loginMedian('compte-qui-nexiste-pas');
    // Le hash factice doit réellement passer par bcrypt (cost 12 ≈ 100-200 ms).
    // Avant correctif : 0,005 ms contre 189 ms, soit un facteur 36 000.
    expect(inexistant).toBeGreaterThan(30);
    const ratio = Math.max(existant, inexistant) / Math.min(existant, inexistant);
    expect(ratio).toBeLessThan(3);
  }, 30000);

  it('un compte Discord (hash "!") ne se distingue pas non plus', async () => {
    db.prepare(`INSERT INTO users (username, password_hash, role, created_at)
                VALUES ('membre-discord-test', '!', 'member', ?)`).run(Date.now());
    const membre = await loginMedian('membre-discord-test');
    expect(membre).toBeGreaterThan(30);
    await request(app).post('/api/auth/login')
      .send({ username: 'membre-discord-test', password: '!' }).expect(401);
  }, 30000);
});

describe('révocation des sessions', () => {
  it('le changement de mot de passe déconnecte les autres sessions', async () => {
    const vole = request.agent(app);      // cookie « volé »
    const legitime = request.agent(app);
    await vole.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PW }).expect(200);
    await legitime.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PW }).expect(200);
    await vole.get('/api/auth/me').expect(200);

    await legitime.post('/api/auth/change-password')
      .send({ current: ADMIN_PW, next: 'MotDePasseTemporaire!1' }).expect(200);

    await vole.get('/api/auth/me').expect(401);        // session volée révoquée
    await legitime.get('/api/auth/me').expect(200);    // auteur du changement toujours connecté

    // Remet le mot de passe d'origine pour les autres fichiers de test.
    await legitime.post('/api/auth/change-password')
      .send({ current: 'MotDePasseTemporaire!1', next: ADMIN_PW }).expect(200);
  }, 30000);

  it('verifySessionUser rejette un cookie révoqué (WebSocket et OAuth)', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PW }).expect(200);
    const cookie = /md_session=([^;]+)/.exec(
      (await agent.post('/api/auth/login').send({ username: 'admin', password: ADMIN_PW }))
        .headers['set-cookie'].join(';'),
    )[1];
    expect(verifySessionUser(decodeURIComponent(cookie))?.username).toBe('admin');

    // Après un logout-all, le même cookie ne doit plus ouvrir /ws-panel.
    await agent.post('/api/settings/security/logout-all').expect(200);
    expect(verifySessionUser(decodeURIComponent(cookie))).toBeNull();
  }, 30000);
});

describe('cloisonnement des jetons (secret unique)', () => {
  it('un jeton éditeur ou média ne vaut pas une session panel', async () => {
    const editeur = issueEditorToken({ channelId: 1, username: 'admin' });
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${editeur}`).expect(401);
    expect(verifySessionUser(editeur)).toBeNull();

    const media = jwt.sign({ f: 'x.webp' }, config.jwtSecret, { expiresIn: '2h' });
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${media}`).expect(401);
  });

  it('un jeton signé avec l\'algorithme "none" est refusé', async () => {
    const none = jwt.sign({ typ: 'session', sub: 1, ep: getSessionEpoch() }, '', { algorithm: 'none' });
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${none}`).expect(401);
    expect(verifySessionUser(none)).toBeNull();
  });
});

describe('journal d\'audit', () => {
  it('enregistre l\'IP source des tentatives de connexion', async () => {
    await request(app).post('/api/auth/login')
      .send({ username: 'traceur-test', password: 'faux' }).expect(401);
    const row = db.prepare("SELECT ip FROM audit_log WHERE actor = 'traceur-test' AND action = 'auth.login.fail' ORDER BY id DESC LIMIT 1").get();
    expect(row).toBeDefined();
    expect(row.ip).toBeTruthy();
  });
});
