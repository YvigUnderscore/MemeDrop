# 🎬 MemeBomb

**Bomb your friends' screens with memes (image / GIF / video / sound) + text**, triggered from a Discord bot or a full web editor.

MemeBomb is **self-hosted**, **free and open-source (MIT)**, built to be **transparent** (no hidden telemetry, fully readable code) and **safe** (strict media validation, ffmpeg re-transcoding, text moderation, mandatory whitelist).

Repository: **https://github.com/YvigUnderscore/MemeBomb**

```
┌──────────────┐         ┌────────────────────────────┐        ┌────────────────────┐
│  Discord bot │──/meme──▶│  MemeBomb server (Docker)  │──WS───▶│  Client (overlay)  │
│  or Editor   │         │  API · WS · Moderation     │        │  Windows .exe      │
└──────────────┘         │  Web panel · SQLite        │        │  16:9 · overlay    │
                         └────────────────────────────┘        └────────────────────┘
```

## ✨ Features

### Server
- 🤖 **Discord bot**: `/meme`, `/link` (one-command pairing), `/feed` (repost public memes into a Discord channel — per channel or per group), whitelist & group management. No privileged intents.
- 🧩 **Multi-channel**: several isolated instances (one friend group / Discord server = one channel).
- 🪪 **Discord sign-in** for everyone: staff and whitelisted members log into the web panel with one click; profile page with Discord name & avatar, custom name color + glow shown on the overlay.
- 🏆 **Hall of Memes**: live weekly top 10 of public memes, archived forever every week (survives retention), with comments and reactions.
- 🔊 **Loudness normalization** (EBU R128): every incoming audio is capped — no more screamers.
- ⏳ **Sender warmup**: memes sent right after connecting are queued (anti "send & run"), staff bypasses.
- 🛡️ **Security**: magic-byte validation, **ffmpeg re-transcoding** (strips metadata/payloads), strict CSP, rate-limiting, signed tokens, SSRF-guarded remote fetches, **zero-config secrets** (auto-generated & persisted).
- 🧹 **Moderation**: configurable text filter, mandatory guidelines, manual review mode, reports, bans.
- 🖥️ **Modern web panel**: all settings, moderation, stats, audit log, global admin page.

### Web editor (`/compose`, works on mobile too)
- 16:9 WYSIWYG stage, multi-layer (text / emoji / image / video / GIF / drawing), drag & drop layer ordering, double-click text editing.
- **Corner-pin distortion** (perspective) on every element, baked with a homography warp — videos distorted server-side with ffmpeg.
- **GIF search (GIPHY)**, myinstants soundboard, personal & shared sound libraries, paste an image **or an image URL** (Ctrl+V).
- Recipient picking (everyone / groups / members), placement preview, duration & animation in/out timing, scheduling, save to library.

### Client (Windows)
- 🪟 Transparent, always-on-top, **click-through** overlay; 16:9 placement identical on any screen (ultrawide included); self-healing visibility watchdog.
- 🎞️ Image / GIF / video / sound playback with **max volume cap**, per-type duration caps, cooldowns, reactions, "seen by", confetti milestones.
- 🚦 **Streaming-friendly**: no hooks/injection/screen capture → does not break Netflix/Prime.
- ⬇️ Bandwidth-limited media downloads (default 5 MB/s).

## 🚀 Quick start

### 1. Server (Docker — zero-config)
```bash
git clone https://github.com/YvigUnderscore/MemeBomb.git
cd MemeBomb
docker compose up -d
docker logs memebomb   # the generated admin password is printed on first start
```
Panel at `http://<host>:8080`. Optional settings (Discord bot, Discord sign-in, Giphy…): copy `.env.example` to `.env` and fill what you need, then `docker compose up -d` again.

➡️ Detailed guide (TrueNAS Scale & any Docker host): [`docs/INSTALL_TRUENAS.md`](docs/INSTALL_TRUENAS.md)

### 2. Client (Windows)
Download `MemeBomb-Setup-x.y.z.exe` from the *Releases* (or build it, see [`docs/CLIENT.md`](docs/CLIENT.md)), run it, then either paste the **server URL + pairing code**, or just run `/link` in Discord to get a code.

## 📦 Repository layout

```
MemeBomb/
├── server/            # Node backend (bot + API + WS + serves panel & editor)
├── panel/             # React web panel (built into the Docker image)
├── web-editor/        # Standalone meme editor (served at /compose)
├── client/            # Electron app (Windows .exe)
├── docker-compose.yml # Server deployment
├── .env.example       # Configuration (all optional)
└── docs/              # Documentation
```

## 🧩 Dependencies

**Server** (Node 20+): express, helmet, express-rate-limit, better-sqlite3, discord.js, fluent-ffmpeg (+ ffmpeg-static / ffprobe-static, or system ffmpeg in Docker), sharp, multer, zod, jsonwebtoken, bcryptjs, ws, nanoid, cookie-parser, file-type, dotenv.
**Panel**: React 18, react-router, Vite, Tailwind CSS, lucide-react.
**Client**: Electron 33, ws.
**Optional third-party services**: Discord API (bot & OAuth), GIPHY API (GIF search — needs a free `GIPHY_API_KEY`), myinstants.com (soundboard search).

All dependencies are open-source; MemeBomb itself is and will stay **free and open-source**.

## 🔐 Transparency & antivirus
- 100% readable code, MIT license, **no obfuscation**.
- The client **injects nothing** into other processes, reads no external memory, captures no screen.
- Code-signing tips and antivirus false-positive reduction: [`docs/CLIENT.md`](docs/CLIENT.md#antivirus).

## 📜 License
MIT — see [`LICENSE`](LICENSE). Free forever.
