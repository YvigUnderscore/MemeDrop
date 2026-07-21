import { useEffect, useState } from 'react';
import { Plus, Trash2, Boxes, Save, SlidersHorizontal } from 'lucide-react';
import { ChannelAPI } from '../../lib/api.js';
import { Card, Modal, Badge, EmptyState, Spinner } from '../../components/ui.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { FeatureOverrideEditor } from './WhitelistTab.jsx';

export default function GroupsTab({ channel }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [groups, setGroups] = useState(null);
  const [whitelist, setWhitelist] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [flagsFor, setFlagsFor] = useState(null);
  const saveFlags = async (features) => { try { await ChannelAPI.updateGroup(channel.id, flagsFor.id, { name: flagsFor.name, members: flagsFor.members, features }); setFlagsFor(null); toast.success('Group features updated'); load(); } catch (e) { toast.error(e.message); } };

  const load = () => {
    ChannelAPI.groups(channel.id).then(setGroups).catch((e) => toast.error(e.message));
    ChannelAPI.whitelist(channel.id).then(setWhitelist).catch(() => {});
  };
  useEffect(() => { load(); }, [channel.id]);

  const openNew = () => { setEditing(null); setName(''); setMembers([]); setOpen(true); };
  const openEdit = (g) => { setEditing(g); setName(g.name); setMembers(g.members); setOpen(true); };
  const toggle = (id) => setMembers((m) => m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);

  const save = async () => {
    setBusy(true);
    try {
      if (editing) await ChannelAPI.updateGroup(channel.id, editing.id, { name, members });
      else await ChannelAPI.createGroup(channel.id, { name, members });
      toast.success('Group saved'); setOpen(false); load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const remove = async (g) => { if (!(await confirm({ message: `Supprimer le groupe "${g.name}" ?`, danger: true, confirmLabel: 'Supprimer' }))) return; try { await ChannelAPI.removeGroup(channel.id, g.id); load(); } catch (e) { toast.error(e.message); } };

  const nameOf = (id) => whitelist.find((w) => w.discord_id === id)?.discord_username || id;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold">Groupes de destinataires</h3>
          <p className="text-sm text-muted">Preset mention lists to target several people at once.</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Nouveau groupe</button>
      </div>

      {!groups ? <Spinner className="text-accent" /> : groups.length === 0 ? (
        <EmptyState icon={Boxes} title="No groups" hint="Create a group to send a meme to several friends at once." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-surface-2 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold flex items-center gap-2"><Boxes size={16} className="text-accent" /> {g.name}</div>
                <Badge tone="accent">{g.members.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {g.members.slice(0, 8).map((id) => <span key={id} className="chip bg-surface text-muted border border-border">{nameOf(id)}</span>)}
                {g.members.length > 8 && <span className="chip text-muted">+{g.members.length - 8}</span>}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => openEdit(g)}>Modifier</button>
                <button className="btn-ghost !px-2.5" title="Features" onClick={() => setFlagsFor(g)}><SlidersHorizontal size={15} /></button>
                <button className="btn-ghost text-danger !px-2.5" onClick={() => remove(g)}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Modifier le groupe' : 'Nouveau groupe'} wide>
        <div className="space-y-4">
          <label className="block"><span className="label">Nom du groupe</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Squad gaming" autoFocus /></label>
          <div>
            <span className="label">Members ({members.length} selected)</span>
            {whitelist.length === 0 ? <p className="text-sm text-muted">The whitelist is empty — add members first.</p> : (
              <div className="flex flex-wrap gap-2 max-h-52 overflow-auto p-1">
                {whitelist.map((w) => (
                  <button key={w.id} onClick={() => toggle(w.discord_id)}
                    className={`chip border ${members.includes(w.discord_id) ? 'bg-accent/15 text-accent border-accent/40' : 'bg-surface-2 text-muted border-border'}`}>
                    {w.discord_username || w.discord_id}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
            <button className="btn-primary" disabled={busy || !name || members.length === 0} onClick={save}>{busy ? <Spinner /> : <Save size={16} />} Enregistrer</button>
          </div>
        </div>
      </Modal>

      {flagsFor && (
        <FeatureOverrideEditor
          title={`Features — group ${flagsFor.name}`}
          value={flagsFor.features || {}}
          onSave={saveFlags}
          onClose={() => setFlagsFor(null)}
        />
      )}
    </Card>
  );
}
