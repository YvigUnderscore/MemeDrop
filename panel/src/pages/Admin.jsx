import { useEffect, useState } from 'react';
import {
  Server, Shield, ShieldCheck, ShieldAlert, UserPlus, Trash2, LogOut, MonitorX,
  KeyRound, Clock, HardDrive, ScrollText, RefreshCw,
} from 'lucide-react';
import { AuthAPI, SettingsAPI } from '../lib/api.js';
import { Card, Modal, Badge, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const fmtBytes = (b) => (b > 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : `${(b / 1048576).toFixed(1)} MB`);
const fmtUptime = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

export default function Admin() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user, refresh } = useAuth();
  const [info, setInfo] = useState(null);
  const [sec, setSec] = useState(null);
  const [users, setUsers] = useState(null);
  const [auditLog, setAuditLog] = useState(null);
  const [retention, setRetention] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'moderator' });

  const loadAll = () => {
    SettingsAPI.serverInfo().then((i) => { setInfo(i); setRetention(String(i.retention?.days ?? 0)); }).catch((e) => toast.error(e.message));
    SettingsAPI.security().then(setSec).catch(() => {});
    AuthAPI.users().then(setUsers).catch(() => {});
    SettingsAPI.audit().then(setAuditLog).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRetention = async () => {
    try {
      const r = await SettingsAPI.saveRetention(Math.max(0, parseInt(retention, 10) || 0));
      setRetention(String(r.days));
      toast.success(r.days === 0 ? 'Unlimited retention' : `Retention: ${r.days} day(s)`);
    } catch (e) { toast.error(e.message); }
  };
  const purgeAll = async () => {
    if (!(await confirm({ title: 'Danger zone', message: 'PERMANENTLY delete every meme from ALL channels (media included)?', danger: true, confirmLabel: 'Delete everything' }))) return;
    try { const r = await SettingsAPI.purgeAll(); toast.success(`${r.deleted} meme(s) deleted`); loadAll(); }
    catch (e) { toast.error(e.message); }
  };
  const logoutAll = async () => {
    if (!(await confirm({ message: 'Sign out EVERY panel session (including yours)?', danger: true, confirmLabel: 'Sign out all' }))) return;
    try { await SettingsAPI.logoutAll(); toast.success('All sessions signed out'); await refresh(); }
    catch (e) { toast.error(e.message); }
  };
  const revokeDevices = async () => {
    if (!(await confirm({ message: 'Revoke ALL client devices? They will need to pair again.', danger: true, confirmLabel: 'Revoke all' }))) return;
    try { const r = await SettingsAPI.revokeDevices(); toast.success(`${r.revoked} device(s) revoked`); loadAll(); }
    catch (e) { toast.error(e.message); }
  };
  const invalidatePairing = async () => {
    try { const r = await SettingsAPI.invalidatePairing(); toast.success(`${r.invalidated} code(s) invalidated`); loadAll(); }
    catch (e) { toast.error(e.message); }
  };
  const createUser = async () => {
    try { await AuthAPI.createUser(form); toast.success('Account created'); setOpen(false); setForm({ username: '', password: '', role: 'moderator' }); loadAll(); }
    catch (e) { toast.error(e.message); }
  };
  const delUser = async (u) => {
    if (!(await confirm({ message: `Delete the account "${u.username}"?`, danger: true, confirmLabel: 'Delete' }))) return;
    try { await AuthAPI.deleteUser(u.id); loadAll(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Administration</h1>
          <p className="text-muted text-sm">Global management of the MemeDrop server.</p>
        </div>
        <button className="btn-ghost" onClick={loadAll}><RefreshCw size={15} /> Refresh</button>
      </div>

      <Card>
        <h3 className="font-bold mb-4 flex items-center gap-2"><Server size={18} /> Server</h3>
        {!info ? <Spinner className="text-accent" /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div><div className="text-xs text-muted">Version</div><div className="font-semibold">{info.version || '—'} <Badge>{info.env}</Badge></div></div>
            <div><div className="text-xs text-muted">Node</div><div className="font-semibold">{info.node}</div></div>
            <div><div className="text-xs text-muted flex items-center gap-1"><Clock size={12} /> Uptime</div><div className="font-semibold">{fmtUptime(info.uptimeS)}</div></div>
            <div><div className="text-xs text-muted">Public URL</div><div className="font-semibold truncate" title={info.publicUrl}>{info.publicUrl}</div></div>
            <div><div className="text-xs text-muted flex items-center gap-1"><HardDrive size={12} /> Media</div><div className="font-semibold">{fmtBytes(info.storage.mediaBytes)} · {info.storage.mediaFiles} file(s)</div></div>
            <div><div className="text-xs text-muted">Database</div><div className="font-semibold">{fmtBytes(info.storage.dbBytes)}</div></div>
            <div><div className="text-xs text-muted">Discord sign-in (OAuth)</div>
              <div className="font-semibold">{info.oauthEnabled ? <Badge tone="success">configured</Badge> : <Badge tone="danger">not configured</Badge>}</div></div>
          </div>
        )}
        {info && !info.oauthEnabled && (
          <p className="text-xs text-muted mt-3">
            To enable Discord sign-in: <code className="text-accent">DISCORD_CLIENT_ID</code> + <code className="text-accent">DISCORD_CLIENT_SECRET</code> in <code>.env</code>, redirect URL <code className="text-accent">{info.publicUrl}/api/auth/discord/callback</code> in the Discord developer portal, then restart.
          </p>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="font-bold mb-3 flex items-center gap-2"><Clock size={18} /> Meme retention</h3>
          <p className="text-sm text-muted mb-3">Maximum age of the history (media deleted beyond it). 0 = unlimited. Hall of Memes archives are never purged.</p>
          <div className="flex items-center gap-2">
            <input type="number" className="input !w-28" min={0} max={3650} value={retention} onChange={(e) => setRetention(e.target.value)} />
            <span className="text-sm text-muted">days</span>
            <button className="btn-primary" onClick={saveRetention}>Save</button>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <button className="btn-danger" onClick={purgeAll}><Trash2 size={15} /> Purge ALL history (all channels)</button>
          </div>
        </Card>

        <Card>
          <h3 className="font-bold mb-1 flex items-center gap-2 text-danger"><ShieldAlert size={18} /> Security — kill switch</h3>
          <p className="text-sm text-muted mb-4">
            In case of compromise (leaked token, lost device). {sec && (
              <span>Currently: <b>{sec.activeDevices}</b> active device(s), <b>{sec.pendingPairings}</b> pending pairing code(s).</span>
            )}
          </p>
          <div className="grid gap-2">
            <button className="btn-ghost justify-start" onClick={logoutAll}><LogOut size={16} /> Sign out every session</button>
            <button className="btn-ghost justify-start" onClick={invalidatePairing}><KeyRound size={16} /> Invalidate pairing codes</button>
            <button className="btn-danger justify-start" onClick={revokeDevices}><MonitorX size={16} /> Revoke all devices</button>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2"><Shield size={18} /> Panel accounts</h3>
          <button className="btn-primary" onClick={() => setOpen(true)}><UserPlus size={16} /> Add</button>
        </div>
        {!users ? <Spinner className="text-accent" /> : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-3">
                <div className={`w-9 h-9 rounded-lg grid place-items-center ${u.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-muted'}`}>
                  {u.role === 'admin' ? <ShieldCheck size={18} /> : <Shield size={18} />}
                </div>
                <div className="flex-1"><div className="font-medium">{u.username} {u.id === user.id && <Badge>you</Badge>}</div>
                  <div className="text-xs text-muted capitalize">{u.role}</div></div>
                {u.id !== user.id && <button onClick={() => delUser(u)} className="btn-ghost !px-2.5 text-danger"><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-bold mb-3 flex items-center gap-2"><ScrollText size={18} /> Audit log (latest 200)</h3>
        {!auditLog ? <Spinner className="text-accent" /> : (
          <div className="max-h-[420px] overflow-auto text-xs font-mono divide-y divide-border">
            {auditLog.map((a) => (
              <div key={a.id} className="py-1.5 flex gap-3">
                <span className="text-muted shrink-0">{new Date(a.created_at).toLocaleString()}</span>
                <span className="text-accent shrink-0">{a.actor}</span>
                <span className="shrink-0">{a.action}</span>
                <span className="text-muted truncate" title={a.detail}>{a.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New panel account">
        <div className="space-y-3">
          <label className="block"><span className="label">Username</span>
            <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoFocus /></label>
          <label className="block"><span className="label">Password (min. 8 chars)</span>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <label className="block"><span className="label">Role</span>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="moderator">Moderator</option><option value="admin">Administrator</option>
            </select></label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!form.username || form.password.length < 8} onClick={createUser}><UserPlus size={16} /> Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
