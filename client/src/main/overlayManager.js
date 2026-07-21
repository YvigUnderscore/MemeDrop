// ============================================================
//  Fenêtre overlay — transparente, always-on-top, click-through.
//
//  ANTI-DÉTECTION STREAMING : on n'injecte RIEN dans les autres
//  processus, on ne capture pas l'écran, et on n'active PAS
//  setContentProtection (qui ferait comportement type anti-cheat).
//  C'est une simple fenêtre topmost transparente → Netflix/Prime ne
//  la détectent pas et continuent de fonctionner normalement.
// ============================================================
const path = require('node:path');
const { BrowserWindow, screen } = require('electron');

class OverlayManager {
  constructor(store) {
    this.store = store;
    this.win = null;
    this._watchdog = null;
    this._screenHooked = false;
  }

  _targetDisplay() {
    const displays = screen.getAllDisplays();
    const idx = this.store.get().overlay.displayIndex || 0;
    return displays[idx] || screen.getPrimaryDisplay();
  }

  create() {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const d = this._targetDisplay();
    const { x, y, width, height } = d.bounds;

    this.win = new BrowserWindow({
      x, y, width, height,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      fullscreenable: false,
      backgroundColor: '#00000000',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        // La fenêtre overlay est click-through et non focusable : elle ne peut JAMAIS
        // recevoir d'activation utilisateur. Sans cette policy, Chromium bloque la
        // lecture automatique des vidéos AVEC son (les GIF muets, eux, passent),
        // ce qui donne l'impression que « les vidéos ne marchent pas ».
        autoplayPolicy: 'no-user-gesture-required',
      },
    });

    // Click-through total : la souris passe à travers l'overlay.
    // (PAS de { forward: true } : cela renvoie les mousemove et fait "clignoter"
    //  le curseur de redimensionnement des autres fenêtres dans les angles.)
    this.win.setIgnoreMouseEvents(true);
    // Au-dessus même des applications plein écran, sans voler le focus.
    this.win.setAlwaysOnTop(true, 'screen-saver');
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // IMPORTANT : NE PAS activer setContentProtection (déclencherait les détecteurs).

    this.win.loadFile(path.join(__dirname, '..', 'overlay', 'overlay.html'));
    this.win.once('ready-to-show', () => this.win.showInactive());

    // FIX « son mais pas d'image » : si le renderer crashe (GPU, mémoire...),
    // la fenêtre devient un cadre vide — on la recrée immédiatement.
    this.win.webContents.on('render-process-gone', () => {
      try { this.win.destroy(); } catch { /* ignore */ }
      this.win = null;
      setTimeout(() => this.create(), 500);
    });

    // Changements d'écran (branchement/débranchement, résolution) : la fenêtre
    // peut se retrouver hors-écran ou sur un écran disparu → on la recale.
    if (!this._screenHooked) {
      this._screenHooked = true;
      for (const evt of ['display-added', 'display-removed', 'display-metrics-changed']) {
        screen.on(evt, () => setTimeout(() => this.ensureVisible(), 800));
      }
    }
    // Watchdog : Windows fait parfois « tomber » le topmost (app plein écran,
    // redémarrage d'explorer...) — l'audio joue mais l'overlay n'est plus
    // visible. On ré-affirme régulièrement visibilité + topmost + bounds.
    clearInterval(this._watchdog);
    this._watchdog = setInterval(() => this.ensureVisible(), 15000);
    return this.win;
  }

  // Garantit que l'overlay est visible, au bon endroit, au-dessus de tout.
  ensureVisible() {
    if (!this.win || this.win.isDestroyed()) { this.create(); return; }
    try {
      const d = this._targetDisplay();
      const b = this.win.getBounds();
      if (b.x !== d.bounds.x || b.y !== d.bounds.y || b.width !== d.bounds.width || b.height !== d.bounds.height) {
        this.win.setBounds(d.bounds);
      }
      if (!this.win.isVisible()) this.win.showInactive();
      this.win.setAlwaysOnTop(true, 'screen-saver');
    } catch { /* ignore */ }
  }

  relocate() {
    if (!this.win || this.win.isDestroyed()) return;
    const d = this._targetDisplay();
    this.win.setBounds(d.bounds);
  }

  sendMeme(memeWithLocal) {
    this.create();
    this.ensureVisible(); // jamais de meme « audible mais invisible »
    const send = () => this.win.webContents.send('overlay:meme', {
      meme: memeWithLocal,
      settings: this.store.get(),
    });
    if (this.win.webContents.isLoading()) this.win.webContents.once('did-finish-load', send);
    else send();
  }

  pushSettings() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('overlay:settings', this.store.get());
    }
  }

  // Petit toast temporaire (réaction reçue / action) — #6/#15.
  reactionToast(text) { this._send('overlay:toast', { text }); }
  // Réaction flottante montante sur l'overlay (#3).
  floatReaction(emoji) { this._send('overlay:float', { emoji }); }
  // « Vu par » (#1) : un destinataire a affiché mon meme.
  seenBy(name) { this._send('overlay:seen', { name }); }
  // Seuil de réactions franchi (#7) : confettis + son.
  milestone(info) { this._send('overlay:milestone', info || {}); }
  // Progression de téléchargement (#13).
  downloadProgress(info) { this._send('overlay:download', info || {}); }

  _send(channel, payload) {
    this.create();
    const send = () => { if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload); };
    if (this.win.webContents.isLoading()) this.win.webContents.once('did-finish-load', send);
    else send();
  }

  clear() {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send('overlay:clear');
  }

  destroy() {
    clearInterval(this._watchdog);
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }
}

module.exports = { OverlayManager };
