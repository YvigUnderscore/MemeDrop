import { useState } from 'react';
import { KeyRound, Link2, Link2Off, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthAPI, DISCORD_LINK_URL } from '../lib/api.js';
import { Card, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Account() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, isAdmin, discordEnabled, refresh } = useAuth();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const changePw = async () => {
    setBusy(true);
    try { await AuthAPI.changePassword(cur, next); toast.success('Password changed'); setCur(''); setNext(''); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const linkDiscord = () => { window.location.href = DISCORD_LINK_URL; };
  const unlinkDiscord = async () => {
    if (!(await confirm({ message: 'Unlink your Discord account? You will no longer be able to sign in with Discord (your password still works).', confirmLabel: 'Unlink' }))) return;
    try { await AuthAPI.unlinkDiscord(); toast.success('Discord account unlinked'); await refresh(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Accounts</h1>
        <p className="text-muted text-sm">
          Your personal account. {isAdmin && <>Panel accounts and security live in the <Link className="text-accent" to="/admin">Admin</Link> page.</>}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="font-bold mb-4 flex items-center gap-2"><KeyRound size={18} /> Change my password</h3>
          <div className="space-y-3">
            <label className="block"><span className="label">Current password</span>
              <input type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
            <label className="block"><span className="label">New password (min. 8 chars)</span>
              <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
            <button className="btn-primary" disabled={busy || !cur || next.length < 8} onClick={changePw}>{busy ? <Spinner /> : <KeyRound size={16} />} Update</button>
          </div>
        </Card>

        <Card>
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.607-.719 1.398-.984 2.02a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.997-2.02.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 7.55.943 10.65 1.233 13.71a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-3.577-.838-6.652-2.549-9.315a.061.061 0 0 0-.031-.028Z" /></svg>
            Discord account
          </h3>
          {!discordEnabled ? (
            <p className="text-sm text-muted">
              Discord sign-in is not configured: set <code className="text-accent">DISCORD_CLIENT_ID</code> and <code className="text-accent">DISCORD_CLIENT_SECRET</code> in <code>.env</code> then restart the server. {isAdmin && <>Details in the <Link className="text-accent" to="/admin">Admin</Link> page.</>}
            </p>
          ) : user.discordId ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Linked to <b className="text-text">{user.discordUsername || user.discordId}</b>. You can sign in to the panel with Discord.
              </p>
              <button className="btn-ghost text-danger" onClick={unlinkDiscord}><Link2Off size={16} /> Unlink my Discord account</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Link your Discord account to sign in to the panel in one click, no password needed.
              </p>
              <button className="btn-ghost justify-center" onClick={linkDiscord} style={{ background: '#5865F2', color: '#fff', borderColor: 'transparent' }}><Link2 size={16} /> Link my Discord account</button>
            </div>
          )}
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <div className="flex items-center gap-3">
            <Server size={18} className="text-accent" />
            <p className="text-sm text-muted flex-1">Panel accounts, security (kill switch), retention, purge and audit log now live in the Admin page.</p>
            <Link to="/admin" className="btn-primary">Open Admin</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
