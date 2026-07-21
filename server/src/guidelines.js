import { db } from './db.js';

export const DEFAULT_GUIDELINES = `# Règles de la communauté MemeDrop

En envoyant un meme, tu t'engages à respecter ces règles. Le non-respect
entraîne un avertissement, un retrait du droit d'envoi, puis un bannissement.

## ✅ Autorisé
- L'humour, les vannes entre potes, les memes, le second degré.
- **L'humour noir est toléré** — tant qu'il reste dans le respect des personnes.

## ⛔ Interdit
- Contenu **pornographique**, sexuellement explicite ou suggestif impliquant
  des mineurs (tolérance zéro, signalement immédiat).
- Contenu **raciste**, antisémite, homophobe, transphobe, validiste ou toute
  incitation à la haine visant un groupe.
- **Harcèlement**, menaces, doxxing, contenu visant à nuire à une personne réelle.
- Violence gratuite, gore choquant, apologie du terrorisme.
- Contenu illégal, malveillant, ou destiné à tromper/arnaquer.

## 🤝 Bon sens
- Un meme doit faire rire, pas blesser. Dans le doute, s'abstenir.
- Respecte les cooldowns et ne spamme pas l'écran des autres.
- Les modérateurs peuvent retirer un contenu et sanctionner à tout moment.

Signaler un contenu : bouton « Signaler » sur le client, ou \`/report\` sur Discord.`;

export function getGuidelines() {
  const row = db.prepare("SELECT value FROM global_settings WHERE key = 'guidelines'").get();
  return row?.value || DEFAULT_GUIDELINES;
}

// Guidelines effectives pour un channel : override du channel sinon global.
export function getChannelGuidelines(channel) {
  try {
    const s = JSON.parse(channel.settings || '{}');
    if (s.guidelines && s.guidelines.trim()) return s.guidelines;
  } catch { /* ignore */ }
  return getGuidelines();
}

export function setGuidelines(text) {
  db.prepare(`INSERT INTO global_settings (key, value) VALUES ('guidelines', ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(text || ''));
}
