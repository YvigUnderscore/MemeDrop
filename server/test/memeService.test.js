import { describe, it, expect, beforeAll } from 'vitest';
import { db, now } from '../src/db.js';
import { createAndDispatchMeme, sanitizeOptions, resolveTargets } from '../src/memeService.js';

let channel;
beforeAll(() => {
  const info = db.prepare('INSERT INTO channels (slug, name, settings, created_at) VALUES (?,?,?,?)')
    .run('svc-test', 'Svc Test', JSON.stringify({}), now());
  channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(info.lastInsertRowid);
  db.prepare('INSERT INTO whitelist (channel_id, discord_id, discord_username, role, can_send, banned, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(channel.id, '111', 'Alice', 'user', 1, 0, now());
  db.prepare('INSERT INTO whitelist (channel_id, discord_id, discord_username, role, can_send, banned, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(channel.id, '222', 'BobBanni', 'user', 1, 1, now());
});

describe('createAndDispatchMeme', () => {
  it('envoie un meme texte (panel modérateur)', async () => {
    const r = await createAndDispatchMeme({ channel, source: 'panel', sender: 'panel:admin', senderName: 'admin', text: 'coucou', isModerator: true });
    expect(r.id).toBeTruthy();
    const row = db.prepare('SELECT status, text FROM memes WHERE id = ?').get(r.id);
    expect(row.status).toBe('sent');
    expect(row.text).toBe('coucou');
  });

  it('bloque un texte interdit et journalise le meme bloqué', async () => {
    await expect(createAndDispatchMeme({ channel, source: 'panel', sender: 'panel:admin', senderName: 'admin', text: 'sale bougnoule', isModerator: true }))
      .rejects.toThrow(/règles/i);
    const blocked = db.prepare("SELECT COUNT(*) c FROM memes WHERE channel_id = ? AND status = 'blocked'").get(channel.id).c;
    expect(blocked).toBeGreaterThan(0);
  });

  it('refuse un meme totalement vide', async () => {
    await expect(createAndDispatchMeme({ channel, source: 'panel', sender: 'panel:admin', senderName: 'admin', text: '', isModerator: true }))
      .rejects.toThrow();
  });
});

describe('resolveTargets', () => {
  it('ne cible que les membres whitelistés non bannis', () => {
    const t = resolveTargets(channel.id, { mentions: ['111', '222', '999'] });
    expect(t).toContain('111');   // whitelisté ok
    expect(t).not.toContain('222'); // banni
    expect(t).not.toContain('999'); // hors whitelist
  });
});

describe('sanitizeOptions', () => {
  const settings = { maxImageDurationS: 8, defaultVolume: 0.7, defaultOpacity: 0.95 };
  it('borne l\'échelle et l\'opacité', () => {
    const o = sanitizeOptions({ scale: 5, opacity: 9, anchor: 'nope' }, settings, null);
    expect(o.scale).toBeLessThanOrEqual(1);
    expect(o.opacity).toBeLessThanOrEqual(1);
    expect(o.anchor).toBe('center'); // valeur invalide → défaut
  });
  it('valide la couleur du texte', () => {
    expect(sanitizeOptions({ textColor: 'red' }, settings, null).textColor).toBe('#ffffff');
    expect(sanitizeOptions({ textColor: '#12ab34' }, settings, null).textColor).toBe('#12ab34');
  });
});
