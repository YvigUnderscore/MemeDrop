import { useState } from 'react';
import { Link2, Link2Off, Info, Sparkles, Save } from 'lucide-react';
import { AuthAPI, DISCORD_LINK_URL } from '../lib/api.js';
import { Card, Badge, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = { admin: 'Administrator', moderator: 'Moderator', member: 'Member' };

export default function Profile() {
  const { user, discordEnabled, refresh } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [color, setColor] = useState(user?.nameColor || '#ffffff');
  const [glow, setGlow] = useState(user?.nameGlow || '#ff4d2e');
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const displayName = user.discordUsername || user.username;
  const linked = !!user.discordId;
  const isMember = user.role === 'member';

  const linkDiscord = () => { window.location.href = DISCORD_LINK_URL; };
  const unlinkDiscord = async () => {
    if (!(await confirm({ message: 'Unlink your Discord account? Your name and picture will no longer sync.', confirmLabel: 'Unlink' }))) return;
    try { await AuthAPI.unlinkDiscord(); toast.success('Discord account unlinked'); await refresh(); }
    catch (e) { toast.error(e.message); }
  };

  const saveStyle = async () => {
    setBusy(true);
    try { await AuthAPI.saveStyle(color, glow); toast.success('Name style saved'); await refresh(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold">Profile</h1>
        <p className="text-muted text-sm">Your MemeDrop identity — what your friends see when you drop a meme.</p>
      </div>

      <Card>
        <div className="flex items-center gap-5">
          {user.discordAvatarUrl ? (
            <img src={user.discordAvatarUrl} alt="" className="w-20 h-20 rounded-2xl shadow-glow object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-accent-gradient grid place-items-center text-white text-3xl font-extrabold shadow-glow">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-2xl font-extrabold truncate"
              style={{ color, textShadow: `0 0 8px ${glow}, 0 0 20px ${glow}` }}>
              {displayName}
            </div>
            <div className="text-sm text-muted flex items-center gap-2 mt-1.5">
              <Badge tone={user.role === 'admin' ? 'accent' : undefined}>{ROLE_LABELS[user.role] || user.role}</Badge>
              {linked && <Badge tone="success">Discord linked</Badge>}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted mt-4 flex items-start gap-1.5">
          <Info size={14} className="shrink-0 mt-0.5" />
          {linked
            ? 'Your name and picture come from Discord and sync automatically on every sign-in. They cannot be edited here.'
            : 'Link your Discord account to automatically pull your name and profile picture.'}
        </p>
      </Card>

      <Card>
        <h3 className="font-bold mb-1 flex items-center gap-2"><Sparkles size={17} /> Name style on the overlay</h3>
        <p className="text-sm text-muted mb-4">Pick the color and glow of your name as it appears above your memes on everyone's screen.</p>
        <div className="flex flex-wrap items-end gap-5">
          <label className="block">
            <span className="label">Name color</span>
            <input type="color" className="input !p-1 !w-16 !h-10 cursor-pointer" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Glow color</span>
            <input type="color" className="input !p-1 !w-16 !h-10 cursor-pointer" value={glow} onChange={(e) => setGlow(e.target.value)} />
          </label>
          <div className="flex-1 min-w-[160px] rounded-xl bg-black/60 border border-border px-4 py-3 text-center">
            <span className="font-extrabold text-lg" style={{ color, textShadow: `0 0 8px ${glow}, 0 0 20px ${glow}` }}>
              {displayName}
            </span>
          </div>
          <button className="btn-primary" disabled={busy} onClick={saveStyle}>{busy ? <Spinner /> : <Save size={15} />} Save</button>
        </div>
        {!linked && <p className="text-xs text-muted mt-3">Note: the style applies to memes sent with your Discord account (link it below).</p>}
      </Card>

      <Card>
        <h3 className="font-bold mb-3">Discord account</h3>
        {!discordEnabled ? (
          <div className="text-sm text-muted space-y-2">
            <p>Discord sign-in is <b className="text-text">not configured</b> on this server.</p>
            <p className="text-xs">
              Admin: set <code className="text-accent">DISCORD_CLIENT_ID</code> and <code className="text-accent">DISCORD_CLIENT_SECRET</code> in <code>.env</code> (Discord developer portal → your app → OAuth2), add the redirect URL <code className="text-accent">&lt;PUBLIC_URL&gt;/api/auth/discord/callback</code>, then restart the server.
            </p>
          </div>
        ) : linked ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Linked to <b className="text-text">{user.discordUsername || user.discordId}</b>.</p>
            {!isMember && (
              <button className="btn-ghost text-danger" onClick={unlinkDiscord}><Link2Off size={16} /> Unlink my Discord account</button>
            )}
            {isMember && (
              <p className="text-xs text-muted">Your MemeDrop account exists through Discord: it cannot be unlinked.</p>
            )}
          </div>
        ) : (
          <button className="btn-ghost justify-center" onClick={linkDiscord}
            style={{ background: '#5865F2', color: '#fff', borderColor: 'transparent' }}>
            <Link2 size={16} /> Link my Discord account
          </button>
        )}
      </Card>
    </div>
  );
}
