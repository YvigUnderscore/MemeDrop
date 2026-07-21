// ============================================================
//  Discord OAuth2 — connexion au panel et liaison de compte.
//
//  Deux usages :
//   • login : se connecter au panel avec son compte Discord (le compte doit
//             avoir été préalablement lié — aucune création automatique, sinon
//             n'importe quel titulaire d'un compte Discord obtiendrait un accès).
//   • link  : depuis les réglages du profil, lier/délier un compte Discord à un
//             compte panel déjà existant.
//
//  Sécurité :
//   • Le paramètre `state` est un JWT signé (courte durée) + un cookie nonce :
//     protection CSRF de la redirection OAuth (double-submit).
//   • L'intention `link` embarque l'id du compte panel connecté ; le callback
//     revérifie que la session correspond.
//   • Le scope demandé est minimal : `identify`.
//   • Aucune donnée sensible n'est placée dans l'URL de callback.
// ============================================================

import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from './config.js';
import { safeEqual } from './crypto.js';

const AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USER_URL = 'https://discord.com/api/users/@me';
const SCOPE = 'identify';
const STATE_TTL_S = 600; // 10 min

export function isOAuthEnabled() {
  return !!(config.discord.clientId && config.discord.clientSecret && config.discord.redirectUri);
}

// Génère un nonce et le state signé associé. Le nonce est aussi posé en cookie.
export function createState({ intent, userId = null }) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign(
    { intent, userId: userId ?? null, nonce },
    config.jwtSecret,
    { expiresIn: STATE_TTL_S },
  );
  return { nonce, state: token };
}

// Valide le state signé et vérifie la correspondance avec le nonce du cookie.
export function verifyState(stateToken, cookieNonce) {
  if (!stateToken || !cookieNonce) return null;
  let payload;
  try { payload = jwt.verify(stateToken, config.jwtSecret); } catch { return null; }
  if (!payload?.nonce || !safeEqual(payload.nonce, cookieNonce)) return null;
  return { intent: payload.intent, userId: payload.userId ?? null };
}

export function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: config.discord.redirectUri,
    response_type: 'code',
    scope: SCOPE,
    state,
    prompt: 'consent',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// Échange le code d'autorisation contre un access_token (redirect: 'error' → pas de SSRF).
export async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.discord.redirectUri,
  });
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Échange OAuth échoué (HTTP ${resp.status}).`);
  const json = await resp.json();
  if (!json.access_token) throw new Error('Réponse OAuth invalide.');
  return json;
}

// Récupère l'identité Discord (id + username) à partir de l'access_token.
export async function fetchDiscordUser(accessToken) {
  const resp = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Lecture du profil Discord échouée (HTTP ${resp.status}).`);
  const u = await resp.json();
  if (!u?.id) throw new Error('Profil Discord invalide.');
  return {
    id: String(u.id),
    username: u.global_name || u.username || `user_${u.id}`,
    avatar: u.avatar || '',
  };
}
