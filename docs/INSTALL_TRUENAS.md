# Installing MemeBomb — TrueNAS Scale (and any Docker host)

MemeBomb ships as a single Docker container (API + WebSocket + web panel + web editor + Discord bot). Installation is **zero-config**: every secret is auto-generated on first boot.

## Option A — Docker Compose (any host: TrueNAS, Unraid, VPS, Raspberry Pi…)

```bash
git clone https://github.com/YvigUnderscore/MemeBomb.git
cd MemeBomb
docker compose up -d
docker logs memebomb        # ← the generated ADMIN PASSWORD is printed here on first start
```

The panel is available at `http://<host>:8080` (change the port with `PORT=` in `.env`).

That's it. Optionally, `cp .env.example .env` and fill in what you need:

| Variable | Purpose |
|---|---|
| `PUBLIC_URL` | The URL your users will use (**required** for Discord sign-in and correct media links), e.g. `https://memes.example.com` |
| `DISCORD_TOKEN` | Bot token → enables `/meme`, `/link`, `/feed`… |
| `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET` | OAuth2 → "Sign in with Discord" on the panel |
| `GIPHY_API_KEY` | GIF search in the editor (free key at developers.giphy.com) |

After editing `.env`: `docker compose up -d` again.

## Option B — TrueNAS Scale UI (Custom App)

1. **Apps → Discover Apps → Custom App**.
2. Image: build it once on any machine with `docker build -t memebomb -f server/Dockerfile .` and push it to a registry, **or** use *Install via YAML* and paste the repo's `docker-compose.yml`.
3. **Storage**: mount a dataset (e.g. `/mnt/tank/apps/memebomb`) to container path `/data` — this holds the SQLite database, media files and auto-generated secrets.
4. **Networking**: expose container port `8080` on the port of your choice.
5. **Environment**: set `PUBLIC_URL` to the address your friends will use (with a reverse proxy + HTTPS if exposed to the internet). Everything else is optional.
6. Start the app, open the logs once: the generated admin password is printed on first boot.

## Discord setup (bot + sign-in), 5 minutes

1. https://discord.com/developers/applications → **New Application**.
2. **Bot** tab → *Reset Token* → copy it into `DISCORD_TOKEN`. No privileged intents needed.
3. **OAuth2** tab → copy *Client ID* and *Client Secret* into `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, and add the redirect URL: `<PUBLIC_URL>/api/auth/discord/callback`.
4. Invite the bot: OAuth2 → URL Generator → scopes `bot` + `applications.commands` → open the generated URL.
5. In the panel: create a channel, paste the bot token in its **Discord** tab, set the guild ID (recommended for instant slash commands).
6. In Discord: `/whitelist add @friend`, then everyone runs `/link` to pair their desktop app or the web editor.

## Updating

```bash
git pull
docker compose build && docker compose up -d
```

The database migrates automatically on boot. `/data` is never touched by updates.

## Backups

Back up the `/data` dataset (SQLite database + media + secrets). That's the whole state.
