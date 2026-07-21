import { ZodError } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../media.js';

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function loadChannel(req, res, next) {
  const idOrSlug = req.params.channelId || req.params.id;
  const channel = /^\d+$/.test(idOrSlug)
    ? db.prepare('SELECT * FROM channels WHERE id = ?').get(Number(idOrSlug))
    : db.prepare('SELECT * FROM channels WHERE slug = ?').get(idOrSlug);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });
  req.channel = channel;
  next();
}

export function errorMiddleware(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.length ? i.path.join('.') + ' : ' : ''}${i.message}`).join(' ; ');
    return res.status(400).json({ error: msg || 'Requête invalide.' });
  }
  const status = err instanceof HttpError ? err.status : (err.status || 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Erreur serveur' });
}

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'channel';
}
