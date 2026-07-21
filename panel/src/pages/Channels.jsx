import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hash, Plus, Radio, Users, MonitorSmartphone } from 'lucide-react';
import { ChannelAPI } from '../lib/api.js';
import { Card, Modal, Badge, EmptyState, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Channels() {
  const [channels, setChannels] = useState(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { isAdmin } = useAuth();

  const load = () => ChannelAPI.list().then(setChannels).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      await ChannelAPI.create({ name, description: desc });
      toast.success('Channel created');
      setOpen(false); setName(''); setDesc(''); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Channels</h1>
          <p className="text-muted text-sm">Each channel is an isolated instance (one friend group / Discord server).</p>
        </div>
        {isAdmin && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={18} /> Nouveau channel</button>}
      </div>

      {!channels ? <div className="grid place-items-center h-40"><Spinner className="w-7 h-7 text-accent" /></div>
        : channels.length === 0 ? (
          <Card><EmptyState icon={Hash} title="No channels"
            hint="Create a channel to connect a Discord bot and clients."
            action={isAdmin && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Create</button>} /></Card>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {channels.map((c) => (
              <Link key={c.id} to={`/channels/${c.id}`}>
                <Card className="hover:border-accent/50 transition h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl bg-accent-gradient grid place-items-center shadow-glow"><Hash size={22} className="text-white" /></div>
                    <div className="flex gap-1.5">
                      {c.hasDiscord && <Badge tone="accent">Discord</Badge>}
                      {!c.active && <Badge tone="danger">inactif</Badge>}
                    </div>
                  </div>
                  <div className="font-bold text-lg">{c.name}</div>
                  <div className="text-xs text-muted mb-3">/{c.slug}</div>
                  {c.description && <p className="text-sm text-muted line-clamp-2 mb-3">{c.description}</p>}
                  <div className="flex items-center gap-4 text-sm text-muted pt-3 border-t border-border">
                    <span className="flex items-center gap-1"><Radio size={14} className={c.online > 0 ? 'text-success' : ''} /> {c.online}</span>
                    <span className="flex items-center gap-1"><MonitorSmartphone size={14} /> {c.counts.devices}</span>
                    <span className="flex items-center gap-1"><Users size={14} /> {c.counts.whitelist}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

      <Modal open={open} onClose={() => setOpen(false)} title="New channel">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Squad" autoFocus />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea className="input min-h-[80px]" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={!name || busy} onClick={create}>{busy ? <Spinner /> : <Plus size={16} />} Create</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
