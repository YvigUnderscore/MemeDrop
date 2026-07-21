import { useState } from 'react';
import { Bot, Save, ExternalLink, CheckCircle2, Power } from 'lucide-react';
import { ChannelAPI } from '../../lib/api.js';
import { Card, Toggle, Spinner, Badge } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function DiscordTab({ channel, onSaved }) {
  const toast = useToast();
  const [token, setToken] = useState('');
  const [guildId, setGuildId] = useState(channel.discordGuildId || '');
  const [enabled, setEnabled] = useState(channel.hasDiscord);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = { guildId, enabled };
      if (token.trim()) body.token = token.trim();
      await ChannelAPI.saveDiscord(channel.id, body);
      toast.success('Discord configuration saved. The bot is restarting.');
      setToken(''); onSaved?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Bot size={20} className="text-accent" />
          <h3 className="font-bold">Bot Discord de ce channel</h3>
          {channel.hasDiscord && <Badge tone="success"><CheckCircle2 size={12} /> configured</Badge>}
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="label">Token du bot {channel.hasDiscord && <span className="text-muted normal-case">(laisser vide pour conserver)</span>}</span>
            <input type="password" className="input font-mono" placeholder={channel.hasDiscord ? '•••••••••••••••••' : 'Colle le token ici'}
              value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </label>
          <label className="block">
            <span className="label">ID du serveur Discord (guild)</span>
            <input className="input font-mono" placeholder="123456789012345678 (recommended)" value={guildId}
              onChange={(e) => setGuildId(e.target.value.replace(/\D/g, ''))} />
            <span className="text-xs text-muted mt-1 block">Set = instant slash commands on this server. Empty = global (up to 1h propagation).</span>
          </label>
          <div className="divide-y divide-border">
            <Toggle label="Bot enabled" hint="Starts/stops the bot for this channel." checked={enabled} onChange={setEnabled} />
          </div>
          <button className="btn-primary w-full" disabled={busy} onClick={save}>
            {busy ? <Spinner /> : <Save size={16} />} Enregistrer
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold mb-3 flex items-center gap-2"><Power size={18} /> Create the bot (quick guide)</h3>
        <ol className="text-sm text-muted space-y-2 list-decimal list-inside">
          <li>Va sur le <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">portail développeur Discord <ExternalLink size={12} /></a>.</li>
          <li>« New Application » → nomme-la, puis onglet <b>Bot</b> → <b>Reset Token</b> → copie le token.</li>
          <li>Onglet <b>Installation</b> / <b>OAuth2</b> : scopes <code className="text-accent">bot</code> + <code className="text-accent">applications.commands</code>.</li>
          <li>Invite the bot to your server with the generated URL.</li>
          <li>Colle le token ici, renseigne l'ID du serveur, enregistre.</li>
        </ol>
        <div className="mt-4 p-3 rounded-xl bg-surface-2 border border-border text-xs text-muted">
          <b className="text-ink">No privileged intents required</b> — the bot only uses slash commands (/meme, /link, /feed, /whitelist, /group, /guidelines, /report).
        </div>
      </Card>
    </div>
  );
}
