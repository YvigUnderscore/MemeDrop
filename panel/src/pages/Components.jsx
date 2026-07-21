import { useState } from 'react';
import { Hash, Sparkles } from 'lucide-react';
import {
  Card, Badge, Toggle, Stat, Spinner, Skeleton, SkeletonCard, Tooltip, CopyButton,
  Sparkline, EmptyState, Field, IconButton,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useConfirm, usePrompt } from '../components/Confirm.jsx';

// Catalogue de composants (#48) — outillage dev : référence visuelle de tous les
// primitives d'UI, dans le thème courant. Accessible via la palette (Ctrl+K).
function Section({ title, children }) {
  return (
    <Card className="space-y-3">
      <h3 className="font-bold flex items-center gap-2"><Sparkles size={16} className="text-accent" /> {title}</h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </Card>
  );
}

export default function Components() {
  const toast = useToast();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [on, setOn] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Catalogue de composants</h1>
        <p className="text-muted text-sm">Référence visuelle des primitives d'UI (outillage dev).</p>
      </div>

      <Section title="Boutons">
        <button className="btn-primary">Primary</button>
        <button className="btn-ghost">Ghost</button>
        <button className="btn-danger">Danger</button>
        <button className="btn-primary" disabled>Disabled</button>
        <IconButton icon={Hash} label="Icône" onClick={() => {}} />
      </Section>

      <Section title="Badges">
        <Badge>default</Badge>
        <Badge tone="accent">accent</Badge>
        <Badge tone="success">success</Badge>
        <Badge tone="danger">danger</Badge>
        <Badge tone="warning">warning</Badge>
      </Section>

      <Section title="Formulaires">
        <input className="input max-w-[200px]" placeholder="Champ texte" />
        <select className="input max-w-[160px]"><option>Option A</option><option>Option B</option></select>
        <Toggle label="Interrupteur" checked={on} onChange={setOn} />
        <Field label="Champ étiqueté" hint="Astuce sous le champ"><input className="input" /></Field>
      </Section>

      <Section title="Feedback & données">
        <Stat label="Statistique" value="1 234" icon={Hash} />
        <Spinner className="text-accent" />
        <Tooltip label="Je suis une infobulle"><span className="chip bg-surface-2 border border-border">Survole-moi</span></Tooltip>
        <CopyButton value="texte à copier" label="Copier" />
        <Sparkline data={[3, 5, 2, 8, 6, 9, 4, 7, 10, 6]} width={140} height={34} />
      </Section>

      <Section title="Chargement (skeletons)">
        <div className="w-full grid sm:grid-cols-3 gap-3">
          <SkeletonCard />
          <div className="space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-3/4" /></div>
          <Skeleton className="h-24" />
        </div>
      </Section>

      <Section title="Toasts & dialogues">
        <button className="btn-ghost" onClick={() => toast.success('Succès !')}>Toast succès</button>
        <button className="btn-ghost" onClick={() => toast.error('Erreur !')}>Toast erreur</button>
        <button className="btn-ghost" onClick={() => toast.action('Élément supprimé', () => toast.success('Restauré'))}>Toast + Annuler</button>
        <button className="btn-ghost" onClick={async () => { const ok = await confirm({ message: 'Confirmer cette action ?', danger: true }); toast.info(ok ? 'Confirmé' : 'Annulé'); }}>Confirm</button>
        <button className="btn-ghost" onClick={async () => { const v = await prompt({ message: 'Ton nom ?', defaultValue: '' }); if (v != null) toast.info(`Salut ${v || '?'}`); }}>Prompt</button>
      </Section>

      <Section title="État vide">
        <div className="w-full"><EmptyState icon={Hash} title="Rien ici" hint="Exemple d'état vide avec une action." action={<button className="btn-primary">Action</button>} /></div>
      </Section>
    </div>
  );
}
