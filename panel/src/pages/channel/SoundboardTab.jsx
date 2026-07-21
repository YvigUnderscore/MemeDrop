import { useEffect, useRef, useState } from 'react';
import { Music, Upload, Trash2, Play, Pause, Pencil, Tag } from 'lucide-react';
import { ChannelAPI } from '../../lib/api.js';
import { Card, EmptyState, Spinner, Modal, Badge } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';

export default function SoundboardTab({ channel }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', file: null });
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);
  const fileRef = useRef(null);

  const load = () => ChannelAPI.soundboard(channel.id).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); return () => { if (audioRef.current) audioRef.current.pause(); }; }, [channel.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = [...new Set((rows || []).map((s) => s.data?.category).filter(Boolean))];

  const play = (s) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playing === s.id) { setPlaying(null); return; }
    if (!s.url) return;
    const a = new Audio(s.url); audioRef.current = a;
    a.play().catch(() => {}); setPlaying(s.id);
    a.onended = () => setPlaying(null);
  };

  const add = async () => {
    if (!form.file) { toast.error('Choisis un fichier audio.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name || form.file.name);
      fd.append('category', form.category || '');
      fd.append('media', form.file);
      await ChannelAPI.addSharedSound(channel.id, fd);
      toast.success('Sound added to the shared soundboard');
      setOpen(false); setForm({ name: '', category: '', file: null });
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    try {
      await ChannelAPI.updateSharedSound(channel.id, edit.id, { name: edit.name, category: edit.category });
      setEdit(null); toast.success('Sound updated'); load();
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (s) => {
    if (!(await confirm({ message: `Delete "${s.name}" from the shared soundboard?`, danger: true, confirmLabel: 'Delete' }))) return;
    try { await ChannelAPI.removeSharedSound(channel.id, s.id); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Music size={18} /> Shared soundboard</h3>
          <p className="text-sm text-muted">Sounds curated by moderators, available to every channel member.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Upload size={16} /> Ajouter un son</button>
      </div>

      {!rows ? <Spinner className="text-accent" /> : rows.length === 0 ? (
        <EmptyState icon={Music} title="Empty soundboard" hint="Add short sounds (horns, effects, punchlines) everyone can play." />
      ) : (
        <div className="space-y-4">
          {['', ...categories].filter((cat, i, arr) => arr.indexOf(cat) === i).map((cat) => {
            const items = rows.filter((s) => (s.data?.category || '') === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat || '__none'}>
                {cat ? <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1"><Tag size={12} /> {cat}</div>
                  : categories.length > 0 ? <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Uncategorized</div> : null}
                <div className="grid sm:grid-cols-2 gap-2">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 bg-surface-2 border border-border rounded-xl p-2.5">
                      <button onClick={() => play(s)} className="btn-ghost !px-2.5 shrink-0">
                        {playing === s.id ? <Pause size={16} className="text-accent" /> : <Play size={16} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{s.name}</div>
                        <div className="text-xs text-muted">{s.sizeMb} Mo · {s.data?.sharedBy || '—'}</div>
                      </div>
                      <button title="Edit" onClick={() => setEdit({ id: s.id, name: s.name, category: s.data?.category || '' })} className="btn-ghost !px-2.5"><Pencil size={14} /></button>
                      <button title="Delete" onClick={() => remove(s)} className="btn-ghost !px-2.5 text-danger"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add a shared sound">
        <div className="space-y-3">
          <label className="block"><span className="label">Fichier audio</span>
            <input ref={fileRef} type="file" accept="audio/*" className="input !py-2"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null, name: form.name || (e.target.files?.[0]?.name || '').replace(/\.[^.]+$/, '') })} />
          </label>
          <label className="block"><span className="label">Nom</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Air horn" /></label>
          <label className="block"><span className="label">Category (optional)</span>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="FX, Punchlines…" list="sb-cats" />
            <datalist id="sb-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={busy || !form.file} onClick={add}>{busy ? <Spinner /> : <Upload size={16} />} Ajouter</button>
          </div>
          <p className="text-xs text-muted">The file is re-transcoded and sanitized server-side, like any upload.</p>
        </div>
      </Modal>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title="Edit the sound">
          <div className="space-y-3">
            <label className="block"><span className="label">Nom</span>
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="block"><span className="label">Category</span>
              <input className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} list="sb-cats" /></label>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEdit(null)}>Annuler</button>
              <button className="btn-primary" onClick={saveEdit}>Enregistrer</button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
