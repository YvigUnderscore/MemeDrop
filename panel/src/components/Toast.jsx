import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Undo2 } from 'lucide-react';

const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

let idc = 0;
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type, msg, opts = {}) => {
    const id = ++idc;
    const duration = opts.duration ?? (opts.action ? 7000 : 4000);
    setToasts((t) => [...t, { id, type, msg, action: opts.action }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);
  const toast = {
    success: (m, o) => push('success', m, o),
    error: (m, o) => push('error', m, o),
    info: (m, o) => push('info', m, o),
    // Toast avec bouton « Annuler » (#7). action = () => void.
    action: (m, action, o = {}) => push('info', m, { ...o, action }),
    dismiss: remove,
  };
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  const tones = { success: 'border-success/40 text-success', error: 'border-danger/40 text-danger', info: 'border-accent/40 text-accent' };
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={`card px-4 py-3 flex items-start gap-3 border ${tones[t.type]} animate-slide-up`}>
              <Icon size={18} className="mt-0.5 shrink-0" />
              <div className="text-sm text-ink flex-1">{t.msg}</div>
              {t.action && (
                <button
                  onClick={() => { try { t.action(); } finally { remove(t.id); } }}
                  className="text-accent hover:brightness-125 font-semibold text-sm flex items-center gap-1 shrink-0"
                >
                  <Undo2 size={14} /> Annuler
                </button>
              )}
              <button onClick={() => remove(t.id)} aria-label="Fermer la notification" className="text-muted hover:text-ink"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
