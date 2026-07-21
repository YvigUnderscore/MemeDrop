// Service des fichiers média — accès par URL signée uniquement.
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { verifyMediaToken } from '../memeService.js';

const router = Router();

const MIME_BY_EXT = {
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.webm': 'video/webm',
};

router.get('/:file', (req, res) => {
  const file = req.params.file;
  // Garde-fou anti path-traversal : nom de fichier strict.
  if (!/^[A-Za-z0-9_-]+\.(webp|mp4|m4a|webm)$/.test(file)) {
    return res.status(400).end();
  }
  const token = req.query.t;
  if (!token || !verifyMediaToken(file, String(token))) {
    return res.status(403).end();
  }
  const abs = path.join(config.mediaDir, file);
  if (!abs.startsWith(config.mediaDir) || !fs.existsSync(abs)) return res.status(404).end();

  res.setHeader('Content-Type', MIME_BY_EXT[path.extname(file)] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  // sendFile gère les requêtes Range (lecture vidéo/audio).
  res.sendFile(abs);
});

export default router;
