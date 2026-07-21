import { useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield, ShieldCheck, Ban, Check, SlidersHorizontal, User, Search } from 'lucide-react';
import { ChannelAPI } from '../../lib/api.js';
import { Card, Modal, Badge, EmptyState, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { FEATURE_LABELS } from './SettingsTab.jsx';
import MemberProfile from './MemberProfile.jsx';

// Éditeur d'override de fonctionnalités (Défaut / Activé / Désactivé) réutilisable.
export function FeatureOverrideEditor({ value, onSave, onClose, title }) {
  const [f, setF] = useState(value || {});
  const setKey = (k, v) => setF((p) => { const n = { ...p }; if (v === 'default') delete n[k]; else n[k] = v === 'on'; return n; });
  const stateOf = (k) => (f[k] === undefined ? 'default' : f[k] ? 'on' : 'off');
  return (
    <Modal open onClose={onClose} title={title} wide>
      <div className="space-y-2">
        {Object.entries(FEATURE_LABELS).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-sm">{label}</span>
            <select className="input w-40" value={stateOf(k)} onChange={(e) => setKey(k, e.target.value)}>
              <option value="default">Channel default</option>
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-3">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(f)}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

export default function WhitelistTab({ channel }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ discordId: '', discordUsername: '', role: 'user', canSend: true, note: '' });
  const [busy, setBusy] = useState(false);
  const [flagsFor, setFlagsFor] = useState(null);
  const [profileFor, setProfileFor] = useState(null);
  const [filter, setFilter] = useState('');
  // Ajout : par compte Discord connecté à l'app, ou par ID manuel.
  const [addMode, setAddMode] = useState('connected');
  const [discordUsers, setDiscordUsers] = useState(null);
  useEffect(() => {
    if (open) ChannelAPI.whitelistDiscordUsers(channel.id).then(setDiscordUsers).catch(() => setDiscordUsers([]));
  }, [open, channel.id]);
  const parseFeatures = (w) => { try { return JSON.parse(w.features || '{}'); } catch { return {}; } };
  const saveFlags = async (features) => { try { await ChannelAPI.updateWhitelist(channel.id, flagsFor.id, { features }); setFlagsFor(null); toast.success('Features updated'); load(); } catch (e) { toast.error(e.message); } };

  const load = () => ChannelAPI.whitelist(channel.id).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, [channel.id]);

  const add = async () => {
    setBusy(true);
    try { await ChannelAPI.addWhitelist(channel.id, form); toast.success('Member added'); setOpen(false); setForm({ discordId: '', discordUsername: '', role: 'user', canSend: true, note: '' }); load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const patch = async (w, body) => { try { await ChannelAPI.updateWhitelist(channel.id, w.id, body); load(); } catch (e) { toast.error(e.message); } };
  const remove = async (w) => { if (!(await confirm({ message: `Remove ${w.discord_username || 'this member'} from the whitelist?`, danger: true, confirmLabel: 'Remove' }))) return; try { await ChannelAPI.removeWhitelist(channel.id, w.id); load(); } catch (e) { toast.error(e.message); } };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold">Whitelist</h3>
          <p className="text-sm text-muted">Only these Discord members can send memes.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><UserPlus size={16} /> Add</button>
      </div>

      {rows && rows.length > 6 && (
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !pl-9 !py-1.5" placeholder="Filter by name or ID…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      )}

      {!rows ? <Spinner className="text-accent" /> : rows.length === 0 ? (
        <EmptyState icon={Shield} title="Empty whitelist" hint="Add members by Discord ID, or from Discord with /whitelist add." />
      ) : (
        <div className="divide-y divide-border">
          {rows.filter((w) => { const f = filter.trim().toLowerCase(); return !f || (w.discord_username || '').toLowerCase().includes(f) || String(w.discord_id).includes(f); }).map((w) => (
            <div key={w.id} className="flex items-center gap-3 py-3">
              <div className={`w-9 h-9 rounded-lg grid place-items-center ${w.role === 'moderator' ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-muted'}`}>
                {w.role === 'moderator' ? <ShieldCheck size={18} /> : <Shield size={18} />}
              </div>
              <button onClick={() => setProfileFor(w)} className="flex-1 min-w-0 text-left group">
                <div className="font-medium truncate group-hover:text-accent transition">{w.discord_username || <span className="text-muted">—</span>}
                  {w.banned ? <Badge tone="danger">banned</Badge> : null}
                  {!w.can_send && !w.banned ? <Badge tone="warning">read only</Badge> : null}
                </div>
                <div className="text-xs text-muted font-mono">{w.discord_id}{w.note ? ` · ${w.note}` : ''}</div>
              </button>
              <button title="Member profile" onClick={() => setProfileFor(w)} className="btn-ghost !px-2.5"><User size={15} /></button>
              <button title={w.role === 'moderator' ? 'Demote' : 'Promote to moderator'}
                onClick={() => patch(w, { role: w.role === 'moderator' ? 'user' : 'moderator' })}
                className="btn-ghost !px-2.5"><ShieldCheck size={15} className={w.role === 'moderator' ? 'text-accent' : ''} /></button>
              <button title="Features" onClick={() => setFlagsFor(w)} className="btn-ghost !px-2.5"><SlidersHorizontal size={15} /></button>
              <button title={w.banned ? 'Unban' : 'Ban'} onClick={() => patch(w, { banned: !w.banned })}
                className="btn-ghost !px-2.5">{w.banned ? <Check size={15} className="text-success" /> : <Ban size={15} className="text-danger" />}</button>
              <button onClick={() => remove(w)} className="btn-ghost !px-2.5 text-danger"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add to the whitelist">
        <div className="space-y-3">
          {/* Deux modes : sélectionner un compte Discord connecté à l'app, ou saisir un ID. */}
          <div className="flex gap-1">
            <button className={`chip border flex-1 ${addMode === 'connected' ? 'bg-accent/15 text-accent border-accent/40' : 'bg-surface-2 text-muted border-border'}`}
              onClick={() => setAddMode('connected')}>Connected account</button>
            <button className={`chip border flex-1 ${addMode === 'id' ? 'bg-accent/15 text-accent border-accent/40' : 'bg-surface-2 text-muted border-border'}`}
              onClick={() => setAddMode('id')}>Discord ID</button>
          </div>

          {addMode === 'connected' ? (
            !discordUsers ? <Spinner className="text-accent" /> : discordUsers.length === 0 ? (
              <p className="text-sm text-muted">Nobody has connected their Discord account to the app yet (Discord sign-in on the panel).</p>
            ) : (
              <div className="max-h-56 overflow-auto divide-y divide-border">
                {discordUsers.map((u) => (
                  <button key={u.discordId} disabled={u.alreadyListed}
                    onClick={() => setForm({ ...form, discordId: u.discordId, discordUsername: u.username })}
                    className={`w-full flex items-center gap-3 py-2 text-left ${u.alreadyListed ? 'opacity-40 cursor-not-allowed' : form.discordId === u.discordId ? 'text-accent' : 'hover:text-accent'}`}>
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      : <div className="w-8 h-8 rounded-lg bg-surface-2 grid place-items-center text-xs font-bold">{u.username.slice(0, 1).toUpperCase()}</div>}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{u.username} {u.alreadyListed && <Badge>already listed</Badge>}</div>
                      <div className="text-xs text-muted font-mono">{u.discordId}</div>
                    </div>
                    {form.discordId === u.discordId && !u.alreadyListed && <Check size={16} className="text-accent" />}
                  </button>
                ))}
              </div>
            )
          ) : (
            <>
              <label className="block"><span className="label">Discord ID</span>
                <input className="input font-mono" placeholder="123456789012345678" value={form.discordId}
                  onChange={(e) => setForm({ ...form, discordId: e.target.value.replace(/\D/g, '') })} /></label>
              <label className="block"><span className="label">Name (optional)</span>
                <input className="input" value={form.discordUsername} onChange={(e) => setForm({ ...form, discordUsername: e.target.value })} /></label>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Role</span>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">Member</option><option value="moderator">Moderator</option>
              </select></label>
            <label className="block"><span className="label">Can send</span>
              <select className="input" value={form.canSend ? '1' : '0'} onChange={(e) => setForm({ ...form, canSend: e.target.value === '1' })}>
                <option value="1">Yes</option><option value="0">Read only</option>
              </select></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy || !/^\d{5,25}$/.test(form.discordId)} onClick={add}>{busy ? <Spinner /> : <UserPlus size={16} />} Add</button>
          </div>
          {addMode === 'id' && <p className="text-xs text-muted">💡 To get a Discord ID: Settings → Advanced → Developer Mode, then right-click the member → Copy ID.</p>}
        </div>
      </Modal>

      {flagsFor && (
        <FeatureOverrideEditor
          title={`Features — ${flagsFor.discord_username || flagsFor.discord_id}`}
          value={parseFeatures(flagsFor)}
          onSave={saveFlags}
          onClose={() => setFlagsFor(null)}
        />
      )}

      {profileFor && <MemberProfile channel={channel} member={profileFor} onClose={() => setProfileFor(null)} />}
    </Card>
  );
}
