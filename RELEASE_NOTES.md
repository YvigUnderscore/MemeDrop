# MemeDrop v1.2.0 — "Reliable Delivery"

Reliability release: fixes memes arriving empty, the client silently going deaf, and broken images in the panel/editor. Adds in-app update notifications.

## 🐛 Fixes

### Client (Windows)
- **"Sender name but no content"** — media downloads now have a timeout, handle write errors, and reject truncated files instead of delivering an unreadable media. A media meme whose file failed to download now shows a clear "⚠️ Media failed to load" card instead of a silent empty box.
- **"The app stops receiving, I have to reboot it"** — the WebSocket now detects silently-dead ("half-open") connections (Wi-Fi change, sleep/resume) and reconnects automatically, plus a 15 s guard against stuck "connecting" states.
- A failed media download no longer discards the whole meme — it still displays.

### Panel & editor
- **Broken images fixed** — the server CSP now allows Discord avatars (`cdn.discordapp.com`) and GIPHY thumbnails (`*.giphy.com`).

## ✨ New
- **In-app updates** — the client checks GitHub Releases on launch (and every 6 h): a system notification and a tray "Update available" item link straight to the download. Manual check via the tray menu.

---

# MemeDrop v1.1.0 — "Corner Pin"

The biggest MemeDrop release yet: full English UI, one-click Discord sign-in for everyone, a serious editor upgrade, and a zero-config install.

## ✨ New

### For everyone
- **Sign in with Discord** — whitelisted members log into the web panel with one click, no account creation needed. New animated login page.
- **Profile page** — your Discord name & avatar, plus a custom **name color and glow** shown above your memes on everyone's screen.
- **Hall of Memes 2.0** — live weekly top 10 of *public* memes, **archived forever** every Monday (survives media retention), with **comments and reactions** for all members.
- **Discord meme feed** — `/feed set` reposts every public meme into a Discord channel; `/feed group` does the same per recipient group (moderators only).
- **`/link`** — get a pairing code from Discord in one command, for the desktop app or the web editor.

### Editor
- **Corner-pin distortion** (perspective) on every element — drag corner pins, "Distort" mode in the toolbar; videos are distorted server-side with ffmpeg, transparency preserved.
- **GIF search (GIPHY)** and **paste an image URL** (Ctrl+V) straight onto the stage.
- Layer reordering by **drag & drop**, **double-click to edit text**, layer order now faithfully reproduced on recipients' screens.
- Redesigned layout: display options under the stage, background/sound/GIFs as popovers, no page scrolling, **works on mobile** (desktop-first).
- Duration badge; **a video's length now drives the meme duration** (capped by the server); animation **in/out timing** controls (server-capped).
- Local listening volume control (previews & soundboard only).

### Client (Windows)
- Fix: **"sound but no picture"** — the overlay now self-heals (topmost watchdog, display-change tracking, renderer crash recovery).
- Fix: attached sounds/overlays now always reach recipients (downloaded locally, CSP-safe).
- Sender name displayed **bigger with a glow**, Discord avatar shown; volume setting is now a **max cap** (a quieter meme keeps its volume).
- Identical placement on any screen (ultrawide included); transparent-background compositions arrive as real transparent WebM.

### Server & ops
- **Zero-config install**: missing secrets are auto-generated and persisted in `/data`; the admin password is printed in the logs on first boot.
- **Loudness normalization** (EBU R128) on all incoming audio — no more screamers.
- **Sender warmup**: memes sent right after connecting are queued for 2 minutes (configurable), staff bypasses — no more "send & run".
- Global **Admin page** (server info, accounts, kill switch, retention, audit log).
- Whitelist: add members by picking a **connected Discord account** or by ID.
- Fixed myinstants search (upstream redirect), reaction-milestones input, editor cache staleness.

## 🌍 Language
The entire interface (panel, editor, desktop client, Discord bot, API errors) is now in **English**.

## 📦 Install / update

- **Server**: `git pull && docker compose build && docker compose up -d` — or first install: `docker compose up -d` (see README).
- **Client**: install `MemeDrop-Setup-1.1.0.exe` over your existing version (settings and pairing are kept).

MemeDrop is and will stay free & open-source (MIT).
