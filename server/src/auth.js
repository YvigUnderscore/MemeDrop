import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db, now, audit } from './db.js';
import { logger } from './logger.js';
import { hashToken, safeEqual } from './crypto.js';

// ---- Bootstrap du compte admin initial ---------------------------------
export function ensureAdmin() {
  const count = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (count === 0) {
    const hash = bcrypt.hashSync(config.admin.password, 12);
    db.prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)')
      .run(config.admin.username, hash, 'admin', now());
    if (config.admin.generated) {
      // Mot de passe auto-généré (zéro-config) : affiché UNE fois, à la création.
      logger.info('┌──────────────────────────────────────────────────────────┐');
      logger.info(`│  Admin account created — username: ${config.admin.username}`);
      logger.info(`│  Generated password: ${config.admin.password}`);
      logger.info('│  Change it after your first sign-in (Accounts page).');
      logger.info('└──────────────────────────────────────────────────────────┘');
    } else {
      logger.info(`Admin account created: ${config.admin.username}`);
    }
    audit('system', 'admin.bootstrap', config.admin.username);
  }
}

// ---- Sessions panel (JWT via cookie httpOnly) --------------------------
// Hash de comparaison factice, utilisé quand aucun mot de passe réel n'est
// vérifiable (compte inexistant, ou compte Discord dont le hash est '!').
// Il DOIT être un vrai hash bcrypt de 60 caractères au même coût que les
// hashes réels : bcryptjs court-circuite sur `hash.length !== 60` et renvoie
// false instantanément, ce qui trahirait l'existence du compte par le simple
// temps de réponse (mesuré : 0,005 ms contre 189 ms).
const DUMMY_HASH = '$2a$12$ELq/V0bFXWY1//0wqMEBQumymqU3UArjg0XZV4DG8/NSAR3Tijwxi';

export function verifyPassword(username, password) {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  // Un compte 'member' (Discord) porte le hash '!' : pas connectable par mot de
  // passe, mais il doit coûter le même temps qu'un compte normal.
  const hash = (u && typeof u.password_hash === 'string' && u.password_hash.length === 60)
    ? u.password_hash : DUMMY_HASH;
  const ok = bcrypt.compareSync(password, hash);
  return (u && ok && hash !== DUMMY_HASH) ? u : null;
}

// Époque de session : incrémentée pour invalider TOUTES les sessions panel d'un coup (#8).
export function getSessionEpoch() {
  const row = db.prepare("SELECT value FROM global_settings WHERE key = 'sessionEpoch'").get();
  return parseInt(row?.value ?? '0', 10) || 0;
}
export function bumpSessionEpoch() {
  const next = getSessionEpoch() + 1;
  db.prepare(`INSERT INTO global_settings (key, value) VALUES ('sessionEpoch', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(next));
  return next;
}

// Époque de session PAR COMPTE : révoque les sessions d'un seul utilisateur
// (changement de mot de passe) sans déconnecter tout le monde.
export function getUserEpoch(userId) {
  const row = db.prepare('SELECT session_epoch FROM users WHERE id = ?').get(userId);
  return row?.session_epoch ?? 0;
}
export function bumpUserEpoch(userId) {
  db.prepare('UPDATE users SET session_epoch = COALESCE(session_epoch, 0) + 1 WHERE id = ?').run(userId);
  return getUserEpoch(userId);
}

export function issueSession(user) {
  return jwt.sign({
    typ: 'session',
    sub: user.id,
    username: user.username,
    role: user.role,
    ep: getSessionEpoch(),
    uep: getUserEpoch(user.id),
  }, config.jwtSecret, { expiresIn: '7d' });
}

/**
 * Vérifie un cookie/jeton de session panel et renvoie l'utilisateur, ou null.
 * Point de contrôle UNIQUE : la révocation (époque globale + époque du compte)
 * doit s'appliquer partout où une session est acceptée — API REST, WebSocket
 * panel et flux OAuth. La dupliquer, c'est laisser un cookie révoqué passer
 * par la porte qu'on a oublié de fermer.
 */
export function verifySessionUser(token) {
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }); } catch { return null; }
  // Tous les jetons du service partagent le même secret : un jeton éditeur ou
  // média ne doit jamais être accepté comme session. (Les sessions émises avant
  // l'ajout de `typ` n'en portent pas : absence tolérée, valeur étrangère non.)
  if (payload.typ !== undefined && payload.typ !== 'session') return null;
  if ((payload.ep ?? 0) !== getSessionEpoch()) return null;
  const user = db.prepare('SELECT id, username, role, discord_id, discord_username, session_epoch FROM users WHERE id = ?')
    .get(payload.sub);
  if (!user) return null;
  if ((payload.uep ?? 0) !== (user.session_epoch ?? 0)) return null;
  return user;
}

export function panelAuth(req, res, next) {
  const token = req.cookies?.md_session || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const user = verifySessionUser(token);
  if (!user) return res.status(401).json({ error: 'Session expired or revoked' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrators only' });
  next();
}

// Staff = admin ou modérateur. Les comptes 'member' (connexion Discord des
// membres whitelist) n'accèdent qu'à leur profil, jamais aux écrans de gestion.
export function requireStaff(req, res, next) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'moderator') {
    return res.status(403).json({ error: 'Moderators only' });
  }
  next();
}

// ---- Token éditeur éphémère (panel → éditeur web) ----------------------
// Un modérateur/admin ouvre l'éditeur web (iframe) sur un channel : on lui délivre
// un JWT court, borné à ce channel, avec un propriétaire distinct (panel:<user>).
// Aucune ligne `devices` n'est créée : l'appareil est « virtuel ».
export function issueEditorToken({ channelId, username }) {
  return jwt.sign(
    { typ: 'editor', channelId, owner: `panel:${username}`, name: `Panel — ${username}` },
    config.jwtSecret,
    { expiresIn: '3h' },
  );
}

// ---- Authentification des clients (devices) ----------------------------
// Un client s'authentifie avec un token opaque (appareil réel) OU un JWT éditeur
// (appareil virtuel). On stocke uniquement le hash des tokens d'appareil réels.
export function authenticateDevice(token) {
  if (!token) return null;
  // Cas 1 : JWT éditeur (panel). Vérifié par signature, jamais stocké.
  if (token.split('.').length === 3) {
    try {
      const p = jwt.verify(token, config.jwtSecret);
      if (p?.typ === 'editor' && p.channelId) {
        // Appareil virtuel : id=0 (pas de ligne devices), propriétaire panel:<user>.
        return {
          id: 0, virtual: true, channel_id: Number(p.channelId),
          name: p.name || 'Panel', owner: p.owner, discord_id: '', revoked: 0,
        };
      }
    } catch { /* pas un JWT éditeur valide → on tente le token d'appareil opaque */ }
  }
  // Cas 2 : token d'appareil opaque (membre appairé).
  const h = hashToken(token);
  const dev = db.prepare('SELECT * FROM devices WHERE token_hash = ? AND revoked = 0').get(h);
  if (!dev) return null;
  db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(now(), dev.id);
  return dev;
}

// Middleware REST pour endpoints appelés par le client desktop.
export function deviceAuth(req, res, next) {
  const token = (req.headers['x-device-token'] || '').toString()
    || (req.headers.authorization || '').replace(/^Device\s+/i, '');
  const dev = authenticateDevice(token);
  if (!dev) return res.status(401).json({ error: 'Unauthorized device' });
  req.device = dev;
  next();
}

export { safeEqual };
