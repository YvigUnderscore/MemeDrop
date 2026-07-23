import { db } from './db.js';

export const DEFAULT_GUIDELINES = `# MemeDrop community guidelines

By sending a meme you agree to follow these rules. Breaking them leads to a
warning, then losing your right to send, then a ban.

## ✅ Allowed
- Humor, banter between friends, memes, second-degree jokes.
- **Dark humor is tolerated** — as long as it stays respectful of people.

## ⛔ Forbidden
- **Pornographic**, sexually explicit or suggestive content involving minors
  (zero tolerance, reported immediately).
- **Racist**, antisemitic, homophobic, transphobic, ableist content, or any
  incitement to hatred targeting a group.
- **Harassment**, threats, doxxing, content meant to harm a real person.
- Gratuitous violence, shocking gore, glorification of terrorism.
- Illegal, malicious content, or content meant to deceive/scam.

## 🤝 Common sense
- A meme should make people laugh, not hurt. When in doubt, don't.
- Respect cooldowns and don't spam other people's screens.
- Moderators can remove content and sanction at any time.

Report content: the “Report” button in the client, or \`/report\` on Discord.`;

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
