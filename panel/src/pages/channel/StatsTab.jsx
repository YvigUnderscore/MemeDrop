import { useEffect, useState } from 'react';
import { Trophy, Send, Eye, Smile, BarChart3, Download, Image as ImageIcon, TrendingUp } from 'lucide-react';
import { ChannelAPI } from '../../lib/api.js';
import { Card, Spinner, EmptyState, Sparkline } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { exportCSV, exportSummaryPNG } from '../../lib/export.js';

// Liste-classement avec barre proportionnelle.
function BarList({ items, label }) {
  const max = Math.max(1, ...items.map((i) => i.c));
  if (items.length === 0) return <p className="text-sm text-muted">No data.</p>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-5 text-xs text-muted text-right">{i + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-sm mb-0.5">
              <span className="truncate">{it.name || <span className="text-muted italic">{it.label || '—'}</span>}</span>
              <span className="text-muted tabular-nums">{it.c}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-accent-gradient" style={{ width: `${(it.c / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
      {label && <p className="text-xs text-muted pt-1">{label}</p>}
    </div>
  );
}

const RANGES = [{ d: 1, l: '24h' }, { d: 7, l: '7 j' }, { d: 30, l: '30 j' }, { d: 0, l: 'tout' }];

// Regroupe des memes par jour (14 derniers jours) pour la sparkline.
function dailySeries(memes, nDays = 14) {
  const now = Date.now();
  const buckets = new Array(nDays).fill(0);
  for (const m of memes) {
    const age = Math.floor((now - m.created_at) / 86400000);
    if (age >= 0 && age < nDays) buckets[nDays - 1 - age] += 1;
  }
  return buckets;
}

export default function StatsTab({ channel }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [series, setSeries] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setData(null);
    ChannelAPI.leaderboard(channel.id, days).then(setData).catch((e) => toast.error(e.message));
    // Série journalière (14 j) pour la tendance — un seul appel à l'historique.
    ChannelAPI.memes(channel.id, `?limit=100&status=sent&from=${Date.now() - 14 * 86400000}`)
      .then((rows) => setSeries(dailySeries(rows))).catch(() => setSeries([]));
  }, [channel.id, days]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportSenders = () => data && exportCSV(`${channel.slug}-expediteurs.csv`,
    [{ key: 'name', label: 'Membre' }, { key: 'sender', label: 'ID' }, { key: 'c', label: 'Memes' }], data.topSenders);
  const exportPng = () => data && exportSummaryPNG(`${channel.slug}-stats.png`, `MemeBomb — ${channel.name}`, [
    { label: 'Memes sent', value: data.totals.sent },
    { label: 'Confirmed displays', value: data.totals.displays },
    { label: 'Reactions', value: data.totals.reactions },
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold flex items-center gap-2"><BarChart3 size={18} /> Statistiques du channel</h3>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={exportSenders} disabled={!data}><Download size={14} /> CSV</button>
          <button className="btn-ghost !py-1.5 text-xs" onClick={exportPng} disabled={!data}><ImageIcon size={14} /> PNG</button>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button key={r.d} onClick={() => setDays(r.d)}
                className={`chip border ${days === r.d ? 'chip-on' : 'chip-off'}`}>{r.l}</button>
            ))}
          </div>
        </div>
      </div>

      {!data ? <div className="grid place-items-center h-40"><Spinner className="w-7 h-7 text-accent" /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card><div className="text-3xl font-extrabold">{data.totals.sent}</div><div className="text-sm text-muted">memes sent</div></Card>
            <Card><div className="text-3xl font-extrabold">{data.totals.displays}</div><div className="text-sm text-muted">confirmed displays</div></Card>
            <Card><div className="text-3xl font-extrabold">{data.totals.reactions}</div><div className="text-sm text-muted">reactions</div></Card>
            <Card>
              <div className="flex items-center justify-between mb-1"><span className="text-xs text-muted flex items-center gap-1"><TrendingUp size={13} /> 14 j</span><span className="text-sm font-bold">{series.reduce((a, b) => a + b, 0)}</span></div>
              <Sparkline data={series} width={180} height={34} className="w-full" />
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <h4 className="font-bold mb-4 flex items-center gap-2"><Send size={16} className="text-accent" /> Top senders</h4>
              <BarList items={data.topSenders} />
            </Card>
            <Card>
              <h4 className="font-bold mb-4 flex items-center gap-2"><Eye size={16} className="text-accent" /> Top destinataires (affichages)</h4>
              <BarList items={data.topReceivers} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            <Card>
              <h4 className="font-bold mb-4 flex items-center gap-2"><Smile size={16} className="text-accent" /> Most reacted memes</h4>
              {data.topReacted.length === 0 ? <EmptyState icon={Trophy} title="No reactions yet" /> : (
                <div className="space-y-2">
                  {data.topReacted.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
                      <span className="text-sm truncate">{m.text || <span className="text-muted italic">({m.type})</span>} <span className="text-xs text-muted">— {m.sender_name}</span></span>
                      <span className="chip bg-surface border border-border shrink-0">🔥 {m.c}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <h4 className="font-bold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-accent" /> Breakdown by type</h4>
              <BarList items={data.byType.map((t) => ({ name: t.type, c: t.c }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
