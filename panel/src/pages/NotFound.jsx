import { Link } from 'react-router-dom';
import { Compass, Home } from 'lucide-react';
import { t } from '../lib/i18n.js';

export default function NotFound() {
  return (
    <div className="grid place-items-center py-24">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-2 text-accent grid place-items-center mx-auto mb-5"><Compass size={30} /></div>
        <div className="text-5xl font-extrabold mb-2">404</div>
        <p className="text-muted mb-6">{t('notfound.title')}</p>
        <Link to="/" className="btn-primary inline-flex"><Home size={16} /> {t('notfound.home')}</Link>
      </div>
    </div>
  );
}
