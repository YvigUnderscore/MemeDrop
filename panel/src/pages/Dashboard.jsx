import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Hash, MonitorSmartphone, Send, ShieldAlert, Ban, Radio, ArrowRight, Clock } from 'lucide-react';
import { SettingsAPI, ChannelAPI } from '../lib/api.js';
import { usePanelWS } from '../context/PanelWS.jsx';
import { Stat, Card, Badge, EmptyState, SkeletonCard, Skeleton, Sparkline } from '../components/ui.jsx';

function dailySeries(memes, nDays = 14) {
  const now = Date.now();
  const buckets = new Array(nDays).fill(0);
  for (const m of memes) { const age = Math.floor((now - m.created_at) / 86400000); if (age >= 0 && age < nDays) buckets[nDays - 1 - age] += 1; }
  return buckets;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState({}); // channelId -> number[]
  const panelWS = usePanelWS();
  useEffect(() => {
    let alive = true;
    const load = () => SettingsAPI.stats().then((s) => alive && setStats(s)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    // Push temps réel (#4) : rafraîchit immédiatement sur événement.
    const close = panelWS.subscribe((msg) => {
      if (['meme.sent', 'meme.pending', 'meme.blocked', 'report.new'].includes(msg.type)) load();
    });
    return () => { alive = false; clearInterval(t); close(); };
  }, [panelWS]);

  // Sparkline 14 j par channel (#30) — récupérée une seule fois (indépendante du poll 5 s).
  useEffect(() => {
    if (!stats?.channels) return;
    let alive = true;
    stats.channels.forEach((c) => {
      if (series[c.id] !== undefined) return;
      ChannelAPI.memes(c.id, `?limit=100&status=sent&from=${Date.now() - 14 * 86400000}`)
        .then((rows) => alive && setSeries((prev) => ({ ...prev, [c.id]: dailySeries(rows) })))
        .catch(() => alive && setSeries((prev) => ({ ...prev, [c.id]: [] })));
    });
    return () => { alive = false; };
  }, [stats?.channels?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!stats) return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold">Dashboard</h1><p className="text-muted text-sm">Overview of your MemeDrop instance.</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">{Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      <div className="card p-5 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
    </div>
  );
  const t = stats.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="text-muted text-sm">Overview of your MemeDrop instance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <Stat label="Channels" value={t.channels} icon={Hash} />
        <Stat label="Devices" value={t.devices} icon={MonitorSmartphone} />
        <Stat label="Online" value={t.onlineDevices} icon={Radio} tone="success" />
        <Stat label="Memes sent" value={t.memesTotal} icon={Send} />
        <Stat label="Blocked" value={t.memesBlocked} icon={Ban} tone="danger" />
        <Stat label="Pending" value={t.memesPending} icon={Clock} tone="warning" />
        <Stat label="Reports" value={t.openReports} icon={ShieldAlert} tone="warning" />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Channels</h2>
          <Link to="/channels" className="text-sm text-accent hover:underline flex items-center gap-1">
            Manage <ArrowRight size={14} />
          </Link>
        </div>
        {stats.channels.length === 0 ? (
          <EmptyState icon={Hash} title="No channels" hint="Create your first channel to get started."
            action={<Link to="/channels" className="btn-primary">Create a channel</Link>} />
        ) : (
          <div className="divide-y divide-border">
            {stats.channels.map((c) => (
              <Link key={c.id} to={`/channels/${c.id}`} className="flex items-center justify-between py-3 hover:bg-surface-2/50 -mx-2 px-2 rounded-lg transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-surface-2 grid place-items-center text-accent"><Hash size={18} /></div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {c.name} {!c.active && <Badge tone="danger">inactive</Badge>}
                    </div>
                    <div className="text-xs text-muted">/{c.slug}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {series[c.id]?.length > 0 && <Sparkline data={series[c.id]} width={90} height={26} className="hidden sm:block opacity-80" />}
                  <Badge tone={c.online > 0 ? 'success' : 'default'}>{c.online} online</Badge>
                  <span className="text-muted whitespace-nowrap">{c.memes24h} memes / 24h</span>
                  <ArrowRight size={16} className="text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
