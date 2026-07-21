import { Component } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

// Filet de sécurité : évite l'écran blanc si un composant plante (#45).
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('UI error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center p-6">
          <div className="card p-8 max-w-md text-center">
            <div className="w-14 h-14 rounded-2xl bg-danger/15 text-danger grid place-items-center mx-auto mb-4"><AlertOctagon size={28} /></div>
            <h1 className="text-xl font-bold mb-1">Une erreur est survenue</h1>
            <p className="text-sm text-muted mb-5">The interface hit an unexpected problem. Reload the page to continue.</p>
            <pre className="text-left text-[11px] text-muted bg-surface-2 border border-border rounded-lg p-3 mb-5 overflow-auto max-h-32">{String(this.state.error?.message || this.state.error)}</pre>
            <button className="btn-primary mx-auto" onClick={() => location.reload()}><RotateCcw size={16} /> Recharger</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
