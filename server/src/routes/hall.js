// ============================================================
//  Hall of Memes — API accessible à TOUS les comptes panel (staff ET
//  membres connectés via Discord). Un membre ne voit que les channels
//  où son compte Discord est whitelisté.
//  Semaine courante (live) + semaines archivées, relecture des médias,
//  commentaires et réactions.
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { db, now, audit } from '../db.js';
import { panelAuth } from '../auth.js';
import { signMediaUrl } from '../memeService.js';
import { weekStart, weekKey, topMemes } from '../hallArchive.js';
import { asyncHandler } from './helpers.js';

const router = Router();
router.use(panelAuth);

const HALL_EMOJI = ['😂', '❤️', '🔥', '💀', '👏', '😮', '👎', '🤡'];
const isStaff = (u) => u.role === 'admin' || u.role === 'moderator';

/** Channels visibles par l'utilisateur courant. */
function accessibleChannels(user) {
  if (isStaff(user)) return db.prepare('SELECT id, slug, name FROM channels WHERE active = 1 ORDER BY id').all();
  if (!user.discord_id) return [];
  return db.prepare(`SELECT c.id, c.slug, c.name FROM channels c
      JOIN whitelist w ON w.channel_id = c.id
      WHERE c.active = 1 AND w.discord_id = ? AND w.banned = 0 ORDER BY c.id`).all(String(user.discord_id));
}
function requireChannelAccess(req, res, next) {
  const id = Number(req.params.channelId);
  const ok = accessibleChannels(req.user).some((c) => c.id === id);
  if (!ok) return res.status(403).json({ error: 'Channel not accessible.' });
  req.channelId = id;
  next();
}
// L'utilisateur peut-il voir ce meme ? (meme vivant OU archivé, dans un channel accessible)
function memeChannelId(memeId) {
  const m = db.prepare('SELECT channel_id FROM memes WHERE id = ?').get(memeId)
    || db.prepare('SELECT channel_id FROM hall_archive WHERE meme_id = ? LIMIT 1').get(memeId);
  return m?.channel_id ?? null;
}
function requireMemeAccess(req, res, next) {
  const cid = memeChannelId(req.params.memeId);
  if (cid == null || !accessibleChannels(req.user).some((c) => c.id === cid)) {
    return res.status(404).json({ error: 'Meme not found.' });
  }
  req.memeChannelId = cid;
  next();
}

function hallReactionCounts(memeId) {
  const rows = db.prepare('SELECT emoji, COUNT(*) c FROM hall_reactions WHERE meme_id = ? GROUP BY emoji').all(memeId);
  const out = {};
  for (const r of rows) out[r.emoji] = r.c;
  return out;
}
function decorate(userId, item) {
  return {
    ...item,
    comments: db.prepare('SELECT COUNT(*) c FROM meme_comments WHERE meme_id = ?').get(item.memeId).c,
    hallReactions: hallReactionCounts(item.memeId),
    myReactions: db.prepare('SELECT emoji FROM hall_reactions WHERE meme_id = ? AND user_id = ?').all(item.memeId, userId).map((r) => r.emoji),
  };
}

// --- Channels visibles ----------------------------------------------------
router.get('/channels', (req, res) => res.json(accessibleChannels(req.user)));

// --- Semaines disponibles (archives + courante) ---------------------------
router.get('/:channelId/weeks', requireChannelAccess, (req, res) => {
  const weeks = db.prepare('SELECT DISTINCT week FROM hall_archive WHERE channel_id = ? ORDER BY week DESC')
    .all(req.channelId).map((r) => r.week);
  res.json({ current: weekKey(weekStart()), weeks });
});

// --- Top de la semaine (courante = live, sinon archive) -------------------
router.get('/:channelId/top', requireChannelAccess, asyncHandler((req, res) => {
  const week = String(req.query.week || 'current');
  const currentKey = weekKey(weekStart());

  if (week === 'current' || week === currentKey) {
    const from = weekStart().getTime();
    const rows = topMemes(req.channelId, from, from + 7 * 86400000, 10);
    return res.json({
      week: currentKey, live: true,
      memes: rows.map((m, i) => decorate(req.user.id, {
        memeId: m.id, rank: i + 1, type: m.type, text: m.text,
        sender: m.sender, senderName: m.sender_name,
        reactions: m.cnt,
        reactionDetail: (() => {
          const d = {};
          for (const r of db.prepare('SELECT emoji, COUNT(*) c FROM meme_reactions WHERE meme_id = ? GROUP BY emoji').all(m.id)) d[r.emoji] = r.c;
          return d;
        })(),
        mediaUrl: m.media_path ? signMediaUrl(m.media_path) : null,
        mediaMime: m.media_mime,
        createdAt: m.created_at,
      })),
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return res.status(400).json({ error: 'Invalid week.' });
  const rows = db.prepare('SELECT * FROM hall_archive WHERE channel_id = ? AND week = ? ORDER BY rank ASC')
    .all(req.channelId, week);
  res.json({
    week, live: false,
    memes: rows.map((m) => decorate(req.user.id, {
      memeId: m.meme_id, rank: m.rank, type: m.type, text: m.text,
      sender: m.sender, senderName: m.sender_name,
      reactions: m.reactions,
      reactionDetail: JSON.parse(m.reaction_detail || '{}'),
      mediaUrl: m.media_path ? signMediaUrl(m.media_path) : null,
      mediaMime: m.media_mime,
      createdAt: m.meme_created_at,
    })),
  });
}));

// --- Commentaires ---------------------------------------------------------
router.get('/memes/:memeId/comments', requireMemeAccess, (req, res) => {
  const rows = db.prepare('SELECT id, user_id, username, text, created_at FROM meme_comments WHERE meme_id = ? ORDER BY created_at ASC LIMIT 300')
    .all(req.params.memeId);
  res.json(rows.map((r) => ({ id: r.id, userId: r.user_id, username: r.username, text: r.text, createdAt: r.created_at, mine: r.user_id === req.user.id })));
});

router.post('/memes/:memeId/comments', requireMemeAccess, asyncHandler((req, res) => {
  const { text } = z.object({ text: z.string().trim().min(1).max(500) }).parse(req.body);
  const name = req.user.discord_username || req.user.username;
  const info = db.prepare('INSERT INTO meme_comments (meme_id, channel_id, user_id, username, text, created_at) VALUES (?,?,?,?,?,?)')
    .run(req.params.memeId, req.memeChannelId, req.user.id, name, text, now());
  audit(req.user.username, 'hall.comment', { memeId: req.params.memeId });
  res.status(201).json({ id: info.lastInsertRowid, username: name, text, createdAt: now(), mine: true });
}));

// Supprimer un commentaire : son auteur, ou le staff.
router.delete('/comments/:id', asyncHandler((req, res) => {
  const c = db.prepare('SELECT * FROM meme_comments WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Introuvable.' });
  if (c.user_id !== req.user.id && !isStaff(req.user)) return res.status(403).json({ error: 'Forbidden.' });
  db.prepare('DELETE FROM meme_comments WHERE id = ?').run(c.id);
  res.json({ ok: true });
}));

// --- Réactions du Hall (toggle) -------------------------------------------
router.post('/memes/:memeId/react', requireMemeAccess, asyncHandler((req, res) => {
  const { emoji } = z.object({ emoji: z.string() }).parse(req.body);
  if (!HALL_EMOJI.includes(emoji)) return res.status(400).json({ error: 'Emoji not allowed.' });
  const existing = db.prepare('SELECT 1 FROM hall_reactions WHERE meme_id = ? AND user_id = ? AND emoji = ?')
    .get(req.params.memeId, req.user.id, emoji);
  if (existing) {
    db.prepare('DELETE FROM hall_reactions WHERE meme_id = ? AND user_id = ? AND emoji = ?')
      .run(req.params.memeId, req.user.id, emoji);
  } else {
    db.prepare('INSERT INTO hall_reactions (meme_id, channel_id, user_id, emoji, created_at) VALUES (?,?,?,?,?)')
      .run(req.params.memeId, req.memeChannelId, req.user.id, emoji, now());
  }
  res.json({ counts: hallReactionCounts(req.params.memeId), mine: !existing });
}));

export default router;
