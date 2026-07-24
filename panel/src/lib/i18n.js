// Scaffold d'internationalisation (#44).
// L'app est en français ; ce module centralise les chaînes pour préparer une
// future traduction sans refonte. Usage : import { t } from '../lib/i18n.js';
// puis t('login.title'). Les clés absentes retombent sur la clé elle-même.
//
// Pour ajouter une langue : créer un dictionnaire (ex. `en`) de mêmes clés et
// changer LOCALE (ou le lire depuis les préférences utilisateur).

const fr = {
  'common.cancel': 'Annuler',
  'common.confirm': 'Confirmer',
  'common.save': 'Enregistrer',
  'common.delete': 'Supprimer',
  'common.loading': 'Chargement…',
  'common.search': 'Rechercher…',
  'login.title': 'MemeBomb',
  'login.subtitle': "Panel d'administration",
  'login.username': "Nom d'utilisateur",
  'login.password': 'Mot de passe',
  'login.submit': 'Se connecter',
  'nav.dashboard': 'Dashboard',
  'nav.channels': 'Channels',
  'nav.hall': 'Hall of Memes',
  'nav.moderation': 'Modération',
  'nav.guidelines': 'Guidelines',
  'nav.account': 'Comptes',
  'notfound.title': 'This page does not exist or has been moved.',
  'notfound.home': 'Back to Dashboard',
};

const DICTS = { fr };
let LOCALE = 'fr';

export function setLocale(l) { if (DICTS[l]) LOCALE = l; }
export function t(key, vars) {
  let s = (DICTS[LOCALE] && DICTS[LOCALE][key]) || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  return s;
}
