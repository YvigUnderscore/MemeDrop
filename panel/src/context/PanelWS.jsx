import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const PanelWSCtx = createContext(null);
export const usePanelWS = () => useContext(PanelWSCtx);

// Connexion WebSocket panel UNIQUE, partagée par toute l'app (#10).
// Expose le statut de connexion et un mécanisme d'abonnement aux événements.
export function PanelWSProvider({ children }) {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'online' | 'offline'
  const subs = useRef(new Set());
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const closedRef = useRef(false);

  const subscribe = useCallback((fn) => {
    subs.current.add(fn);
    return () => subs.current.delete(fn);
  }, []);

  useEffect(() => {
    closedRef.current = false;
    const open = () => {
      if (closedRef.current) return;
      setStatus((s) => (s === 'online' ? s : 'connecting'));
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws-panel`);
      wsRef.current = ws;
      ws.onopen = () => setStatus('online');
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } subs.current.forEach((fn) => { try { fn(m); } catch { /* ignore */ } }); };
      ws.onclose = () => { if (!closedRef.current) { setStatus('offline'); retryRef.current = setTimeout(open, 3000); } };
      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
    };
    open();
    return () => { closedRef.current = true; clearTimeout(retryRef.current); try { wsRef.current?.close(); } catch { /* ignore */ } };
  }, []);

  return <PanelWSCtx.Provider value={{ status, subscribe }}>{children}</PanelWSCtx.Provider>;
}
