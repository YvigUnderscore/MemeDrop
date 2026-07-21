import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Modal } from './ui.jsx';
import { AlertTriangle } from 'lucide-react';

const ConfirmCtx = createContext(null);
export const useConfirm = () => useContext(ConfirmCtx).confirm;
export const usePrompt = () => useContext(ConfirmCtx).prompt;

// Dialogues thémés (remplacent window.confirm / window.prompt) — promisifiés.
export function ConfirmProvider({ children }) {
  const [dlg, setDlg] = useState(null);
  const [value, setValue] = useState('');
  const resolver = useRef(null);

  const close = useCallback((result) => {
    setDlg(null);
    if (resolver.current) { resolver.current(result); resolver.current = null; }
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setDlg({ kind: 'confirm', title: 'Confirm', danger: false, confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...(typeof opts === 'string' ? { message: opts } : opts) });
  }), []);

  const prompt = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    const o = typeof opts === 'string' ? { message: opts } : opts;
    setValue(o.defaultValue || '');
    setDlg({ kind: 'prompt', title: 'Input', confirmLabel: 'OK', cancelLabel: 'Cancel', ...o });
  }), []);

  return (
    <ConfirmCtx.Provider value={{ confirm, prompt }}>
      {children}
      {dlg && (
        <Modal open title={dlg.title} onClose={() => close(dlg.kind === 'prompt' ? null : false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              {dlg.danger && <div className="w-9 h-9 rounded-lg bg-danger/15 text-danger grid place-items-center shrink-0"><AlertTriangle size={18} /></div>}
              <p className="text-sm text-ink/90 flex-1 whitespace-pre-line">{dlg.message}</p>
            </div>
            {dlg.kind === 'prompt' && (
              <input
                className="input" autoFocus value={value} placeholder={dlg.placeholder || ''}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') close(value); }}
              />
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => close(dlg.kind === 'prompt' ? null : false)}>{dlg.cancelLabel}</button>
              <button className={dlg.danger ? 'btn-danger' : 'btn-primary'} autoFocus={dlg.kind === 'confirm'}
                onClick={() => close(dlg.kind === 'prompt' ? value : true)}>{dlg.confirmLabel}</button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
