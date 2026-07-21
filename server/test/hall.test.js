// Hall of Memes : top hebdo live, archives, commentaires, réactions,
// et accès membre (scopé sur sa whitelist).
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { nanoid } from 'nanoid';
import { createApp } from '../src/app.js';
import { ensureAdmin, issueSession } from '../src/auth.js';
import { db, now } from '../src/db.js';
import { runHallArchive, weekStart, weekKey } from '../src/hallArchive.js';

const app = createApp();
const admin = request.agent(app);
let channelId;
let memeId;
let memberToken; // JWT Bearer d'un compte 'member'

function insertMeme(cid, { id = nanoid(14), text = 'lol', createdAt = now(), reactions = 0 } = {}) {
  db.prepare(`INSERT INTO memes (id, channel_id, sender, sender_name, source, type, text, targets, options, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, cid, '111111111111111', 'Testeur', 'editor', 'text', text, '[]', '{}', 'sent', createdAt);
  for (let i = 0; i < reactions; i++) {
    db.prepare(`INSERT INTO meme_reactions (meme_id, channel_id, device_id, discord_id, name, emoji, created_at)
        VALUES (?,?,?,?,?,?,?)`).run(id, cid, 1000 + i, '', `dev${i}`, '😂', now());
  }
  return id;
}

beforeAll(async () => {
  ensureAdmin();
  await admin.post('/api/auth/login').send({ username: 'admin', password: 'adminpass123' }).expect(200);
  channelId = (await admin.post('/api/channels').send({ name: 'Hall Test' }).expect(201)).body.id;

  // Meme de la semaine courante avec 3 réactions.
  memeId = insertMeme(channelId, { text: 'top de la semaine', reactions: 3 });
  // Meme de la semaine DERNIÈRE avec 5 réactions (sera archivé).
  const lastWeek = weekStart().getTime() - 3 * 86400000 - 7 * 86400000 + 86400000;
  insertMeme(channelId, { text: 'star de la semaine passée', createdAt: lastWeek, reactions: 5 });

  // Compte membre whitelisté sur ce channel.
  db.prepare(`INSERT INTO whitelist (channel_id, discord_id, discord_username, role, can_send, created_at)
      VALUES (?,?,?,?,1,?)`).run(channelId, '222222222222222', 'Membre', 'user', now());
  const info = db.prepare(`INSERT INTO users (username, password_hash, role, discord_id, discord_username, created_at)
      VALUES (?,?,?,?,?,?)`).run('membre-hall', '!', 'member', '222222222222222', 'Membre', now());
  memberToken = issueSession({ id: info.lastInsertRowid, username: 'membre-hall', role: 'member' });
});

describe('hall of memes', () => {
  it('liste le top live de la semaine courante', async () => {
    const r = await admin.get(`/api/hall/${channelId}/top?week=current`).expect(200);
    expect(r.body.live).toBe(true);
    expect(r.body.memes.some((m) => m.memeId === memeId && m.reactions === 3)).toBe(true);
  });

  it('archive la semaine écoulée (top 10 figé)', async () => {
    runHallArchive();
    const weeks = (await admin.get(`/api/hall/${channelId}/weeks`).expect(200)).body.weeks;
    expect(weeks.length).toBeGreaterThan(0);
    const r = await admin.get(`/api/hall/${channelId}/top?week=${weeks[0]}`).expect(200);
    expect(r.body.live).toBe(false);
    expect(r.body.memes[0].text).toBe('star de la semaine passée');
    expect(r.body.memes[0].reactions).toBe(5);
  });

  it('un membre voit le hall de ses channels, un intrus non', async () => {
    const list = (await request(app).get('/api/hall/channels').set('Authorization', `Bearer ${memberToken}`).expect(200)).body;
    expect(list.some((c) => c.id === channelId)).toBe(true);
    // Un membre d'aucun channel : accès refusé.
    const info = db.prepare(`INSERT INTO users (username, password_hash, role, discord_id, created_at)
        VALUES (?,?,?,?,?)`).run('intrus', '!', 'member', '999999999999999', now());
    const intrus = issueSession({ id: info.lastInsertRowid, username: 'intrus', role: 'member' });
    await request(app).get(`/api/hall/${channelId}/top`).set('Authorization', `Bearer ${intrus}`).expect(403);
  });

  it('commente et réagit (toggle) sur un meme du hall', async () => {
    const c = await request(app).post(`/api/hall/memes/${memeId}/comments`)
      .set('Authorization', `Bearer ${memberToken}`).send({ text: 'GG 😂' }).expect(201);
    expect(c.body.username).toBe('Membre');
    const list = (await admin.get(`/api/hall/memes/${memeId}/comments`).expect(200)).body;
    expect(list.some((x) => x.text === 'GG 😂')).toBe(true);

    const r1 = await request(app).post(`/api/hall/memes/${memeId}/react`)
      .set('Authorization', `Bearer ${memberToken}`).send({ emoji: '🔥' }).expect(200);
    expect(r1.body.counts['🔥']).toBe(1);
    const r2 = await request(app).post(`/api/hall/memes/${memeId}/react`)
      .set('Authorization', `Bearer ${memberToken}`).send({ emoji: '🔥' }).expect(200);
    expect(r2.body.counts['🔥']).toBeUndefined(); // toggle → retiré
  });

  it('refuse un emoji hors liste et les comptes member sur les routes staff', async () => {
    await request(app).post(`/api/hall/memes/${memeId}/react`)
      .set('Authorization', `Bearer ${memberToken}`).send({ emoji: '🍆' }).expect(400);
    await request(app).get('/api/channels').set('Authorization', `Bearer ${memberToken}`).expect(403);
    await request(app).get('/api/settings/stats').set('Authorization', `Bearer ${memberToken}`).expect(403);
  });
});
