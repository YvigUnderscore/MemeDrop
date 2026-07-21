# 🖥️ Client MemeDrop (Windows)

Le client reçoit les memes en **overlay** et permet d'en créer via un **éditeur**.

## 1. Installation (utilisateur final)

1. Récupérez **`MemeDrop-Setup-x.y.z.exe`** (dossier `client/dist/` après build,
   ou depuis les *Releases*).
2. Lancez l'installateur, suivez les étapes (raccourci bureau + menu Démarrer).
3. Au premier lancement, la fenêtre **Réglages** s'ouvre :
   - **URL du serveur** : ex. `http://truenas.local:8080` (fournie par l'admin).
   - **Code d'appairage** : généré dans le panel (*Channel → Appareils*) ou par un
     modérateur — valable 30 minutes.
   - **Nom de l'appareil** : ex. « PC de Max ».
   - Cliquez **Appairer**. Le statut passe à 🟢 *Connecté*.

Le client reste en **zone de notification** (tray). Clic sur l'icône = Réglages.

## 2. Utilisation

### Recevoir des memes
Dès qu'un pote envoie un meme (via `/meme` sur Discord ou l'éditeur), il s'affiche
en overlay 16/9. Réglez dans **Réglages** :
- **Overlay** : écran cible, emplacement, taille, opacité, marges, *laisser
  l'expéditeur choisir la position*.
- **Lecture** : volume, mute global, **cooldown** entre memes, **durées max** par
  type (image / GIF / vidéo / son).
- **Réseau** : **débit de téléchargement max** (défaut **5 MB/s**).
- **Raccourcis** : ouvrir l'éditeur, activer/couper l'overlay, mute, ne pas déranger.
- **Options** : animations, ne pas déranger, lancement au démarrage.

### Créer un meme (éditeur)
Raccourci par défaut **Ctrl+Alt+M** (configurable), ou tray → *Éditeur de meme*.
- Choisir une image / GIF / vidéo / son, **ou** faire un meme 100 % texte.
- **Images** : calques de texte déplaçables, emojis, couleur, taille, contour —
  le tout **composé (bakée)** dans l'image envoyée.
- **Vidéo / son / texte** : légendes (haut/bas), position, couleur.
- **Affichage chez le destinataire** : emplacement, taille, durée, animation, volume.
- **Destinataires** : tout le channel, ou des **groupes**/**membres** ciblés.
- **Envoyer** 🚀 (le contenu passe par la modération et le transcodage serveur).

### Raccourcis globaux par défaut
| Action | Raccourci |
|---|---|
| Ouvrir l'éditeur | `Ctrl+Alt+M` |
| Activer/couper l'overlay | `Ctrl+Alt+O` |
| Mute / unmute | `Ctrl+Alt+P` |
| Ne pas déranger | `Ctrl+Alt+D` |

## 3. Build du client (développeurs)

```bash
cd client
npm install
npm run dist      # → client/dist/MemeDrop-Setup-x.y.z.exe
# ou version portable, sans installateur :
npm run pack      # → client/dist/win-unpacked/MemeDrop.exe
```

> **Windows — erreur de symlink au build ?**
> electron-builder extrait l'outil `winCodeSign` qui contient des liens
> symboliques (macOS). Sous Windows, leur création exige le **Mode développeur**.
> Activez-le : *Paramètres → Confidentialité et sécurité → Espace développeurs →
> Mode développeur = Activé*. (Alternative : lancer le terminal **en administrateur**.)
> Une fois activé, `npm run dist` fonctionne sans autre manipulation.

Développement (hot main process) : `npm start`.

<a name="antivirus"></a>
## 4. Antivirus & transparence

Un exécutable Electron **non signé** peut déclencher un faux-positif (SmartScreen,
certains AV) — c'est courant et **pas** le signe d'un logiciel malveillant. MemeDrop
est **open-source (MIT)**, non obfusqué, et **n'a aucun comportement intrusif**
(pas d'injection dans d'autres applis, pas de capture d'écran, pas de lecture mémoire).

Pour réduire/éliminer les alertes :

1. **Signer le code (recommandé)** — la vraie solution. Procurez-vous un certificat
   *Authenticode* (idéalement **EV**, qui bâtit tout de suite la réputation SmartScreen),
   puis dans `client/electron-builder.yml` :
   ```yaml
   win:
     certificateFile: build/cert.pfx
     certificatePassword: ${env.CSC_KEY_PASSWORD}
   ```
   et buildez avec `CSC_KEY_PASSWORD=...`.
2. **Réputation** : SmartScreen fait confiance à un binaire signé au fil des
   téléchargements. Publier les *Releases* et distribuer toujours le **même exe signé**
   accélère la levée des avertissements.
3. **Compression normale** : la config évite la compression agressive type UPX,
   qui est un déclencheur classique d'antivirus.
4. **Compilation reproductible** : buildez depuis les sources publiques pour que
   n'importe qui vérifie que l'exe correspond au code.
5. **Faux positif** : signalez-le à l'éditeur AV (la plupart ont un formulaire de
   *false positive submission*) — la détection disparaît généralement sous quelques jours.

> ℹ️ Sans certificat, l'app fonctionne parfaitement ; l'utilisateur clique juste
> « Informations complémentaires → Exécuter quand même » au premier lancement.
