import { useEffect, useMemo, useState } from 'react';
import { MonitorSmartphone, KeyRound, Trash2, Search, Link2 } from 'lucide-react';
import { ChannelAPI } from '../../lib/api.js';
import { Card, Modal, Badge, EmptyState, Spinner, CopyButton, Tooltip } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';

function ago(ts) {
  if (!ts) return 'never';
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)} min ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)} h ago`;
  return `${Math.floor(d / 86400000)} d ago`;
}
// En ligne si vu il y a moins de 90 s (heartbeat WS = 30 s).
const isOnline = (ts) => ts && (Date.now() - ts) < 90000;

export default function DevicesTab({ channel }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [devices, setDevices] = useState(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  // Membres whitelistés — pour lier un appareil à un compte Discord (avatar sur l'overlay).
  const [members, setMembers] = useState([]);
  const [pairMember, setPairMember] = useState('');
  const [linking, setLinking] = useState(null); // appareil en cours de liaison

  const load = () => ChannelAPI.devices(channel.id).then(setDevices).catch((e) => toast.error(e.message));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [channel.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { ChannelAPI.whitelist(channel.id).then(setMembers).catch(() => {}); }, [channel.id]);

  const memberName = (id) => members.find((m) => m.discord_id === id)?.discord_username || id;

  const generate = async () => {
    setBusy(true);
    try {
      const r = await ChannelAPI.pairCode(channel.id, { label, ttlMinutes: 30, ...(pairMember ? { discordId: pairMember } : {}) });
      setCode(r);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const linkDevice = async (discordId) => {
    try {
      await ChannelAPI.updateDevice(channel.id, linking.id, { discordId });
      toast.success(discordId ? `Linked to ${memberName(discordId)} — their Discord avatar now shows on memes.` : 'Device unlinked.');
      setLinking(null); load();
    } catch (e) { toast.error(e.message); }
  };
  const revoke = async (d) => { if (!(await confirm({ message: `Revoke the device "${d.name}"?`, danger: true, confirmLabel: 'Revoke' }))) return; try { await ChannelAPI.revokeDevice(channel.id, d.id); load(); } catch (e) { toast.error(e.message); } };
  const close = () => { setOpen(false); setCode(null); setLabel(''); load(); };

  const list = useMemo(() => {
    const active = (devices || []).filter((d) => !d.revoked);
    const f = filter.trim().toLowerCase();
    const filtered = f ? active.filter((d) => (d.name || '').toLowerCase().includes(f) || String(d.discord_id || '').includes(f)) : active;
    // En ligne d'abord, puis par dernière activité.
    return filtered.sort((a, b) => (isOnline(b.last_seen) - isOnline(a.last_seen)) || (b.last_seen || 0) - (a.last_seen || 0));
  }, [devices, filter]);

  const onlineCount = (devices || []).filter((d) => !d.revoked && isOnline(d.last_seen)).length;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="font-bold flex items-center gap-2">Client devices
            {onlineCount > 0 && <Badge tone="success">{onlineCount} online</Badge>}</h3>
          <p className="text-sm text-muted">One device = one desktop client installation paired to this channel.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><KeyRound size={16} /> Pairing code</button>
      </div>

      {devices && devices.filter((d) => !d.revoked).length > 4 && (
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !pl-9 !py-1.5" placeholder="Filter devices…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      )}

      {!devices ? <Spinner className="text-accent" /> : list.length === 0 ? (
        <EmptyState icon={MonitorSmartphone} title={filter ? 'No matching devices' : 'No devices'} hint={filter ? undefined : 'Generate a pairing code and enter it in the desktop client.'} />
      ) : (
        <div className="divide-y divide-border">
          {list.map((d) => (
            <div key={d.id} className="flex items-center gap-3 py-3 dense-row">
              <div className="relative w-9 h-9 rounded-lg bg-surface-2 grid place-items-center text-accent shrink-0">
                <MonitorSmartphone size={18} />
                <Tooltip label={isOnline(d.last_seen) ? 'Online' : 'Offline'}>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${isOnline(d.last_seen) ? 'bg-success' : 'bg-muted/50'}`} />
                </Tooltip>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.name} {d.discord_id ? <Badge tone="accent">@{memberName(d.discord_id)}</Badge> : null}</div>
                <div className="text-xs text-muted">{isOnline(d.last_seen) ? <span className="text-success">online</span> : `seen ${ago(d.last_seen)}`}</div>
              </div>
              <Tooltip label={d.discord_id ? 'Change linked member' : 'Link to a Discord member (shows their avatar on memes)'}>
                <button onClick={() => setLinking(d)} aria-label="Link to member" className={`btn-ghost !px-2.5 ${d.discord_id ? 'text-accent' : ''}`}><Link2 size={15} /></button>
              </Tooltip>
              <button onClick={() => revoke(d)} aria-label="Revoke" className="btn-ghost !px-2.5 text-danger"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={close} title="Pair a device">
        {!code ? (
          <div className="space-y-4">
            <label className="block"><span className="label">Device name (optional)</span>
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Max PC" autoFocus /></label>
            <label className="block"><span className="label">Link to a Discord member (optional — shows their avatar on memes)</span>
              <select className="input" value={pairMember} onChange={(e) => setPairMember(e.target.value)}>
                <option value="">Nobody — anonymous device</option>
                {members.filter((m) => !m.banned).map((m) => (
                  <option key={m.discord_id} value={m.discord_id}>{m.discord_username || m.discord_id}</option>
                ))}
              </select></label>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" disabled={busy} onClick={generate}>{busy ? <Spinner /> : <KeyRound size={16} />} Generate the code</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted">Enter this code in the desktop client (valid 30 min):</p>
            <div className="flex items-center justify-center gap-2">
              <div className="text-3xl font-mono font-bold tracking-[0.3em] bg-surface-2 border border-border rounded-xl px-5 py-4">{code.code}</div>
              <CopyButton value={code.code} label="Copy the code" size={18} className="!p-3 btn-ghost" />
            </div>
            <div className="text-xs text-muted flex items-center justify-center gap-1">Server URL: <code className="text-accent">{window.location.origin}</code> <CopyButton value={window.location.origin} label="Copy the URL" /></div>
            <button className="btn-primary w-full" onClick={close}>Done</button>
          </div>
        )}
      </Modal>

      <Modal open={!!linking} onClose={() => setLinking(null)} title={`Link "${linking?.name || ''}" to a member`}>
        <div className="space-y-4">
          <p className="text-sm text-muted">Memes sent from this device will carry the member's identity: Discord avatar and name style on the recipients' overlay.</p>
          <div className="max-h-64 overflow-y-auto divide-y divide-border">
            {members.filter((m) => !m.banned).map((m) => (
              <button key={m.discord_id} onClick={() => linkDevice(m.discord_id)}
                className={`w-full text-left px-3 py-2.5 hover:bg-surface-2 transition flex items-center gap-2 ${linking?.discord_id === m.discord_id ? 'text-accent font-medium' : ''}`}>
                <Link2 size={14} className="shrink-0" /> {m.discord_username || m.discord_id}
              </button>
            ))}
            {members.filter((m) => !m.banned).length === 0 && <p className="text-sm text-muted py-2">No whitelisted members.</p>}
          </div>
          <div className="flex justify-between gap-2">
            {linking?.discord_id
              ? <button className="btn-ghost text-danger" onClick={() => linkDevice('')}>Unlink</button>
              : <span />}
            <button className="btn-ghost" onClick={() => setLinking(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
