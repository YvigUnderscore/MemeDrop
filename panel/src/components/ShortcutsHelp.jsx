import { Modal } from './ui.jsx';

const GROUPS = [
  {
    title: 'Global', items: [
      [['Ctrl', 'K'], 'Command palette'],
      [['?'], 'This help'],
      [['g', 'd'], 'Go to Dashboard'],
      [['g', 'c'], 'Go to Channels'],
      [['g', 'h'], 'Go to Hall of Memes'],
      [['g', 'm'], 'Go to Moderation'],
      [['t'], 'Toggle light / dark theme'],
    ],
  },
  {
    title: 'Lists & modals', items: [
      [['Esc'], 'Close the dialog'],
      [['↑', '↓'], 'Navigate the palette'],
      [['Enter'], 'Confirm'],
    ],
  },
];

function Keys({ keys }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <kbd key={i} className="min-w-[22px] text-center text-[11px] font-semibold bg-surface-2 border border-border rounded px-1.5 py-0.5">{k}</kbd>
      ))}
    </span>
  );
}

export default function ShortcutsHelp({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" wide>
      <div className="grid sm:grid-cols-2 gap-6">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{g.title}</h4>
            <div className="space-y-1.5">
              {g.items.map(([keys, label], i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-ink/90">{label}</span>
                  <Keys keys={keys} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
