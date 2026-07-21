// ============================================================
//  Médias distants : recherche Giphy + import d'une image/GIF par URL
//  (collage d'un lien dans l'éditeur).
//
//  Sécurité (anti-SSRF) :
//   • https uniquement, redirections REFUSÉES (redirect: 'error') ;
//   • hôtes littéraux IP et noms locaux interdits, résolution DNS vérifiée
//     contre les plages privées avant la requête ;
//   • taille plafonnée, Content-Type image/vidéo exigé ;
//   • le contenu repasse TOUJOURS par processMedia (magic bytes + transcodage).
// ============================================================

import net from 'node:net';
import dns from 'node:dns/promises';
import { HttpError } from './media.js';
import { config } from './config.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export function giphyEnabled() { return !!config.giphyKey; }

/** Recherche Giphy → [{ id, title, preview, url }]. */
export async function searchGiphy(query, limit = 24) {
  if (!config.giphyKey) throw new HttpError(503, 'Giphy search is not configured (set GIPHY_API_KEY).');
  const q = String(query || '').trim().slice(0, 100);
  if (!q) return [];
  const u = `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(config.giphyKey)}`
    + `&q=${encodeURIComponent(q)}&limit=${Math.min(50, limit)}&rating=pg-13&lang=en`;
  let resp;
  try { resp = await fetch(u, { signal: AbortSignal.timeout(10000), redirect: 'error' }); }
  catch { throw new HttpError(502, 'Giphy is unreachable.'); }
  if (!resp.ok) throw new HttpError(502, `Giphy search failed (HTTP ${resp.status}).`);
  const json = await resp.json();
  return (json.data || []).map((g) => ({
    id: g.id,
    title: (g.title || '').slice(0, 100),
    preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url || '',
    url: g.images?.original?.url || '',
  })).filter((g) => g.url);
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)
      || a >= 224; // multicast/réservé
  }
  const low = ip.toLowerCase();
  return low === '::1' || low === '::' || low.startsWith('fc') || low.startsWith('fd')
    || low.startsWith('fe80') || low.startsWith('::ffff:'); // v4-mappé → re-vérifié en v4 sinon bloqué
}

/** Télécharge une image/GIF/vidéo depuis une URL publique https → { buffer, mime }. */
export async function fetchRemoteMedia(rawUrl, maxBytes = 25 * 1048576) {
  let u;
  try { u = new URL(String(rawUrl)); } catch { throw new HttpError(400, 'Invalid URL.'); }
  if (u.protocol !== 'https:') throw new HttpError(400, 'Only https:// links are allowed.');
  if (u.username || u.password) throw new HttpError(400, 'Credentials in URLs are not allowed.');
  if (net.isIP(u.hostname) || /^(localhost|.*\.(local|internal|lan|home|corp))$/i.test(u.hostname)) {
    throw new HttpError(400, 'This host is not allowed.');
  }
  // Résolution DNS : refuse les hôtes pointant vers des adresses privées.
  try {
    const addrs = await dns.lookup(u.hostname, { all: true, verbatim: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      throw new HttpError(400, 'This host is not allowed.');
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, 'Could not resolve this host.');
  }

  let resp;
  try {
    resp = await fetch(u.href, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000), redirect: 'error' });
  } catch { throw new HttpError(502, 'Could not download this link (redirects are not followed).'); }
  if (!resp.ok) throw new HttpError(502, `Download failed (HTTP ${resp.status}).`);
  const ct = (resp.headers.get('content-type') || '').split(';')[0].trim();
  if (!/^(image|video)\//.test(ct)) throw new HttpError(415, 'This link is not an image, GIF or video.');
  const len = Number(resp.headers.get('content-length') || 0);
  if (len && len > maxBytes) throw new HttpError(413, 'File too large.');
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!buf.length) throw new HttpError(502, 'Empty file.');
  if (buf.length > maxBytes) throw new HttpError(413, 'File too large.');
  return { buffer: buf, mime: ct };
}
