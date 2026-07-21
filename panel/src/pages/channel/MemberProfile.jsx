import { useEffect, useState } from 'react';
import { Send, Eye, Smile, Ban, MonitorSmartphone, Image as ImageIcon, Film, Music, Type, ShieldOff } from 'lucide-react';
import { ChannelAPI } from '../../lib/api.js';
import { Modal, Spinner, Badge } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';

const ICONS = { image: ImageIcon, gif: Film, video: Film, audio: Music, text: Type };

function Thumb({ m }) {
  const Icon = ICONS[m.type] || Type;
  if (m.mediaUrl && m.type === 'image') return <img src={m.mediaUrl} alt="" className="w-full h-full object-cover" />;
  if (m.mediaUrl && (m.type === 'video' || m.type === 'gif')) return <video src={m.mediaUrl} className="w-full h-full object-cover" muted />;
  return (
    <div className="w-full h-full grid place-items-center bg-gradient-to-br from-accent/20 to-surface-2 p-1 text-center">
      {m.text ? <span className="text-[10px] font-bold text-ink line-clamp-3">{m.text}</span> : <Icon size={18} className="text-muted" />}
    </div>
  );
}

function StatBox({ icon: Icon, value, label }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-3 text-center">
      <Icon size={16} className="mx-auto text-accent mb-1" />
      <div className="text-xl font-extrabold leading-none">{value}</div>
      <div className="text-[11px] text-muted mt-1">{label}</div>
    </div>
  );
}

export default function MemberProfile({ channel, member, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    ChannelAPI.memberProfile(channel.id, member.discord_id).then(setData).catch((e) => { toast.error(e.message); onClose(); });
  }, [channel.id, member.discord_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = `Profil — ${member.discord_username || member.discord_id}`;

  return (
    <Modal open onClose={onClose} title={title} wide>
      {!data ? <div className="grid place-items-center h-40"><Spinner className="w-7 h-7 text-accent" /></div> : (
        <div className="space-y-5 max-h-[70vh] overflow-auto pr-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={data.member.role === 'moderator' ? 'accent' : 'default'}>{data.member.role === 'moderator' ? 'moderator' : 'member'}</Badge>
            {data.member.banned ? <Badge tone="danger">banni</Badge> : null}
            {!data.member.can_send && !data.member.banned ? <Badge tone="warning">lecture seule</Badge> : null}
            <span className="text-xs text-muted font-mono">{data.member.discord_id}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <StatBox icon={Send} value={data.stats.sent} label="sent" />
            <StatBox icon={Eye} value={data.stats.displays} label="displays" />
            <StatBox icon={Smile} value={data.stats.reactionsReceived} label="reactions received" />
            <StatBox icon={Smile} value={data.stats.reactionsGiven} label="reactions given" />
            <StatBox icon={Ban} value={data.stats.blocked} label="blocked (mod.)" />
          </div>

          {Object.keys(data.reactionsBreakdown).length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Reactions received</h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.reactionsBreakdown).sort((a, b) => b[1] - a[1]).map(([e, c]) => (
                  <span key={e} className="chip bg-surface border border-border text-sm">{e} {c}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-sm mb-2">Memes sent ({data.gallery.length})</h4>
            {data.gallery.length === 0 ? <p className="text-sm text-muted">No memes sent.</p> : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {data.gallery.map((m) => (
                  <div key={m.id} title={m.text || m.type} className="aspect-video rounded-lg overflow-hidden bg-black border border-border"><Thumb m={m} /></div>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><MonitorSmartphone size={14} /> Appareils ({data.devices.length})</h4>
              {data.devices.length === 0 ? <p className="text-sm text-muted">No linked devices.</p> : (
                <div className="divide-y divide-border">
                  {data.devices.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="truncate">{d.name}</span>
                      {d.revoked ? <Badge tone="danger">revoked</Badge>
                        : <span className="text-xs text-muted">{d.lastSeen ? new Date(d.lastSeen).toLocaleDateString('fr-FR') : '—'}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><ShieldOff size={14} /> Blocked senders ({data.blocks.length})</h4>
              {data.blocks.length === 0 ? <p className="text-sm text-muted">Has not blocked anyone.</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {data.blocks.map((b) => (
                    <span key={b.senderId} className="chip bg-surface border border-border">{b.name || b.senderId}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
