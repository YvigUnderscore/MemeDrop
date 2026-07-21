// Preload sécurisé : expose une API minimale et contrôlée aux renderers.
// contextIsolation = true, nodeIntegration = false → aucun accès Node dans les pages.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('memedrop', {
  // --- Config / réglages ---
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
  resetShortcuts: () => ipcRenderer.invoke('config:resetShortcuts'),
  getDefaults: () => ipcRenderer.invoke('config:defaults'),
  getDisplays: () => ipcRenderer.invoke('displays:get'),

  // --- Connexion serveur ---
  pair: (serverUrl, code, deviceName) => ipcRenderer.invoke('conn:pair', { serverUrl, code, deviceName }),
  unpair: (slug) => ipcRenderer.invoke('conn:unpair', slug),
  reconnect: () => ipcRenderer.invoke('conn:reconnect'),
  listChannels: () => ipcRenderer.invoke('channels:list'),
  setActiveChannel: (slug) => ipcRenderer.invoke('channels:setActive', slug),
  openWebsite: () => ipcRenderer.invoke('website:open'),
  getStatus: () => ipcRenderer.invoke('conn:status'),
  fetchServerConfig: () => ipcRenderer.invoke('conn:serverConfig'),
  onStatus: (cb) => { const h = (_e, s) => cb(s); ipcRenderer.on('conn:statusChanged', h); return () => ipcRenderer.removeListener('conn:statusChanged', h); },

  // --- Cibles / planifications / réglages partagés (utilisés par les Réglages) ---
  // La composition & l'envoi de memes vivent désormais sur le site (éditeur web).
  getTargets: () => ipcRenderer.invoke('editor:targets'),
  listSchedules: () => ipcRenderer.invoke('schedules:list'),
  deleteSchedule: (id) => ipcRenderer.invoke('schedules:delete', id),
  membersSettings: () => ipcRenderer.invoke('settings:members'),

  // --- Overlay (utilisé par la page overlay) ---
  onOverlayMeme: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('overlay:meme', h); return () => ipcRenderer.removeListener('overlay:meme', h); },
  onOverlaySettings: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('overlay:settings', h); return () => ipcRenderer.removeListener('overlay:settings', h); },
  onOverlayClear: (cb) => { const h = () => cb(); ipcRenderer.on('overlay:clear', h); return () => ipcRenderer.removeListener('overlay:clear', h); },
  onOverlayToast: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('overlay:toast', h); return () => ipcRenderer.removeListener('overlay:toast', h); },
  onOverlayFloat: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('overlay:float', h); return () => ipcRenderer.removeListener('overlay:float', h); },
  onOverlaySeen: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('overlay:seen', h); return () => ipcRenderer.removeListener('overlay:seen', h); },
  onOverlayMilestone: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('overlay:milestone', h); return () => ipcRenderer.removeListener('overlay:milestone', h); },
  onOverlayDownload: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on('overlay:download', h); return () => ipcRenderer.removeListener('overlay:download', h); },
  reportMeme: (memeId, reason) => ipcRenderer.invoke('overlay:report', { memeId, reason }),
  memeFinished: (memeId) => ipcRenderer.send('overlay:finished', memeId),
  memeDisplayed: (memeId, slug) => ipcRenderer.send('overlay:displayed', { memeId, slug }),

  // --- Blocages personnels (#15) ---
  listBlocks: () => ipcRenderer.invoke('blocks:list'),
  addBlock: (senderId, name) => ipcRenderer.invoke('blocks:add', { senderId, name }),
  removeBlock: (senderId) => ipcRenderer.invoke('blocks:remove', senderId),

  // --- Fenêtres / infos ---
  getVersion: () => ipcRenderer.invoke('app:version'),
  openSettings: () => ipcRenderer.invoke('win:settings'),
  openEditor: () => ipcRenderer.invoke('win:editor'),
  testMeme: () => ipcRenderer.invoke('debug:testMeme'),

  // --- Guidelines ---
  getGuidelines: () => ipcRenderer.invoke('guidelines:get'),
  acceptGuidelines: () => ipcRenderer.invoke('guidelines:accept'),
});
