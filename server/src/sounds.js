// ============================================================
//  Intégration myinstants.com (#13) — recherche et import de sons.
//
//  Sécurité : seul le domaine myinstants.com est autorisé (anti-SSRF),
//  taille plafonnée, et le fichier importé est TOUJOURS re-transcodé par
//  le pipeline média (processMedia) avant stockage — comme tout upload.
// ============================================================

import { HttpError } from './media.js';

const HOST_RX = /^(www\.)?myinstants\.com$/i;
// UA type navigateur : certains CDN refusent les UA exotiques.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Recherche des sons sur myinstants et renvoie [{ title, url }]. */
export async function searchMyInstants(query, limit = 24) {
  const q = String(query || '').trim().slice(0, 80);
  if (!q) return [];
  let html;
  try {
    // URL localisée (/fr/) : le chemin non préfixé (/search/) renvoie désormais
    // une redirection 302 — incompatible avec redirect:'error' (anti-SSRF).
    const resp = await fetch(`https://www.myinstants.com/fr/search/?name=${encodeURIComponent(q)}`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    if (!resp.ok) throw new HttpError(502, `Sound search unavailable (HTTP ${resp.status}).`);
    html = await resp.text();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, `Sound search unavailable (${e?.cause?.code || e.message || 'network'}).`);
  }
  const rx = /<button class="small-button" onclick="play\('(\/media\/sounds\/[^']+\.mp3)'[^)]*\)"[^>]*title="([^"]+)"/g;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = rx.exec(html)) && out.length < limit) {
    const url = `https://www.myinstants.com${m[1]}`;
    if (seen.has(url)) continue;
    seen.add(url);
    // Décode les entités HTML basiques et retire l'habillage du title
    // (« Jouer le son de X » / « Play X sound » selon la locale).
    const title = m[2]
      .replace(/^Jouer le son de\s+/i, '').replace(/^Play\s+/i, '').replace(/\s+sound$/i, '')
      .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').slice(0, 80);
    out.push({ title, url });
  }
  return out;
}

/** Télécharge un mp3 myinstants (SSRF-guardé, taille plafonnée) → Buffer. */
export async function downloadMyInstants(rawUrl, maxBytes = 8 * 1024 * 1024) {
  let u;
  try { u = new URL(String(rawUrl)); } catch { throw new HttpError(400, 'Invalid sound URL.'); }
  if (u.protocol !== 'https:' || !HOST_RX.test(u.hostname)) {
    throw new HttpError(400, 'Only myinstants.com sounds are allowed.');
  }
  if (!/\.mp3$/i.test(u.pathname)) throw new HttpError(400, 'The sound must be an .mp3 file.');

  let resp;
  try {
    // redirect: 'error' → une redirection (potentiellement vers une IP interne) fait échouer
    // la requête au lieu d'être suivie : le contrôle d'hôte ci-dessus ne peut pas être contourné.
    resp = await fetch(u.href, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'error' });
  } catch { throw new HttpError(502, 'Could not download the sound.'); }
  if (!resp.ok) throw new HttpError(502, `Could not download the sound (HTTP ${resp.status}).`);

  const len = Number(resp.headers.get('content-length') || 0);
  if (len && len > maxBytes) throw new HttpError(413, 'Sound too large.');
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length > maxBytes) throw new HttpError(413, 'Sound too large.');
  if (buf.length === 0) throw new HttpError(502, 'Empty sound.');
  return buf;
}
