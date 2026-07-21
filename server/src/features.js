// Calcul des feature-flags effectifs pour un membre.
// Précédence : défaut du channel → groupes du membre → override du membre.
import { db, getChannelSettings, FEATURE_KEYS } from './db.js';

function allTrue() {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]));
}

export function effectiveFeatures(channel, discordId) {
  const s = getChannelSettings(channel);
  const flags = { ...allTrue(), ...(s.features || {}) };

  if (discordId && !String(discordId).startsWith('device:')) {
    // Groupes contenant le membre.
    const groups = db.prepare('SELECT members, features FROM mention_groups WHERE channel_id = ?').all(channel.id);
    for (const g of groups) {
      let members = [];
      try { members = JSON.parse(g.members || '[]').map(String); } catch { /* ignore */ }
      if (members.includes(String(discordId))) {
        try { Object.assign(flags, JSON.parse(g.features || '{}')); } catch { /* ignore */ }
      }
    }
    // Override du membre.
    const w = db.prepare('SELECT features FROM whitelist WHERE channel_id = ? AND discord_id = ?')
      .get(channel.id, String(discordId));
    if (w) { try { Object.assign(flags, JSON.parse(w.features || '{}')); } catch { /* ignore */ } }
  }
  return flags;
}

export function assertFeature(channel, discordId, key, label) {
  const flags = effectiveFeatures(channel, discordId);
  if (flags[key] === false) {
    const err = new Error(`This feature is disabled for you: ${label || key}.`);
    err.status = 403;
    throw err;
  }
}
