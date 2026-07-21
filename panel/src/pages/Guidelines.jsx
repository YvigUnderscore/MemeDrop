import { useEffect, useState } from 'react';
import { Save, ScrollText, Clock, Trash2 } from 'lucide-react';
import { SettingsAPI } from '../lib/api.js';
import { Card, Spinner } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// Rendu markdown minimal et sûr (pas de HTML injecté, pas de dangerouslySetInnerHTML).
// Gère le gras **texte** en le découpant en fragments, jamais en HTML brut.
function renderInline(line) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => (part.startsWith('**') && part.endsWith('**'))
    ? <strong key={i}>{part.slice(2, -2)}</strong>
    : <span key={i}>{part}</span>);
}

function renderMd(text) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-lg mt-4 mb-1">{renderInline(line.slice(3))}</h3>;
    if (line.startsWith('# ')) return <h2 key={i} className="font-extrabold text-xl mt-2 mb-2">{renderInline(line.slice(2))}</h2>;
    if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc text-muted">{renderInline(line.slice(2))}</li>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <p key={i} className="text-muted">{renderInline(line)}</p>;
  });
}

export default function Guidelines() {
  const toast = useToast();
  const confirm = useConfirm();
  const { isAdmin } = useAuth();
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(false);
  const [retention, setRetention] = useState(7);

  useEffect(() => {
    SettingsAPI.guidelines().then((r) => setText(r.text)).catch((e) => toast.error(e.message));
    SettingsAPI.retention().then((r) => setRetention(r.days)).catch(() => {});
  }, []);

  const saveRetention = async () => {
    try { const r = await SettingsAPI.saveRetention(Number(retention)); setRetention(r.days); toast.success('Retention saved'); }
    catch (e) { toast.error(e.message); }
  };
  const purgeAll = async () => {
    if (!(await confirm({ title: 'Danger zone', message: 'Delete ALL history from ALL channels? Irreversible.', danger: true, confirmLabel: 'Delete everything' }))) return;
    try { const r = await SettingsAPI.purgeAll(); toast.success(`${r.deleted} meme(s) deleted`); }
    catch (e) { toast.error(e.message); }
  };

  const save = async () => {
    setBusy(true);
    try { await SettingsAPI.saveGuidelines(text); toast.success('Guidelines saved'); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (text === null) return <div className="grid place-items-center h-64"><Spinner className="w-7 h-7 text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2"><ScrollText size={24} /> Guidelines</h1>
          <p className="text-muted text-sm">Rules shown in the client and via <code className="text-accent">/guidelines</code> sur Discord.</p>
        </div>
        {isAdmin && <button className="btn-primary" disabled={busy} onClick={save}>{busy ? <Spinner /> : <Save size={16} />} Enregistrer</button>}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="font-bold mb-3 text-sm text-muted uppercase tracking-wide">Edit (markdown)</h3>
          <textarea className="input min-h-[500px] font-mono text-xs leading-relaxed" value={text}
            disabled={!isAdmin} onChange={(e) => setText(e.target.value)} />
          {!isAdmin && <p className="text-xs text-muted mt-2">Seuls les administrateurs peuvent modifier les guidelines.</p>}
        </Card>
        <Card>
          <h3 className="font-bold mb-3 text-sm text-muted uppercase tracking-wide">Preview</h3>
          <div className="prose-invert space-y-0.5">{renderMd(text)}</div>
        </Card>
      </div>

      {isAdmin && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <h3 className="font-bold mb-3 flex items-center gap-2"><Clock size={18} /> History retention</h3>
            <p className="text-sm text-muted mb-3">Older memes are deleted automatically (media included). 0 = keep forever.</p>
            <div className="flex items-center gap-3">
              <input type="number" className="input w-28" min={0} max={3650} value={retention} onChange={(e) => setRetention(e.target.value)} />
              <span className="text-muted text-sm">days</span>
              <button className="btn-primary" onClick={saveRetention}><Save size={16} /> Enregistrer</button>
            </div>
          </Card>
          <Card>
            <h3 className="font-bold mb-2 flex items-center gap-2 text-danger"><Trash2 size={18} /> Zone dangereuse</h3>
            <p className="text-sm text-muted mb-3">Immediately deletes all history from every channel.</p>
            <button className="btn-danger" onClick={purgeAll}>Delete everything (global)</button>
          </Card>
        </div>
      )}
    </div>
  );
}
