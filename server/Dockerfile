# ============================================================
#  MemeDrop — image serveur (panel web inclus)
#  Contexte de build attendu : racine du dépôt.
#    docker build -f server/Dockerfile -t memedrop .
# ============================================================

# ---- Stage 1 : build du panel web --------------------------
FROM node:22-bookworm-slim AS panel-build
WORKDIR /build/panel
COPY panel/package*.json ./
RUN npm ci --no-audit --no-fund
COPY panel/ ./
RUN npm run build   # → /build/panel/dist

# ---- Stage 2 : dépendances serveur (natif compilable) ------
FROM node:22-bookworm-slim AS server-deps
WORKDIR /build/server
# Outils de build au cas où un binaire prébuilt manque (better-sqlite3 / sharp).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- Stage 3 : runtime -------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV DATA_DIR=/data
# ffmpeg pour le re-transcodage média (garantie anti-injection).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# --chown pose l'ownership au moment de la copie : évite un `chown -R` final
# très lent (des milliers de fichiers dans node_modules), surtout sur ZFS.
COPY --chown=node:node server/package*.json ./
COPY --chown=node:node --from=server-deps /build/server/node_modules ./node_modules
COPY --chown=node:node server/src ./src
COPY --chown=node:node --from=panel-build /build/panel/dist ./public
# Éditeur web autonome (page statique hors SPA) servie sous /compose.
COPY --chown=node:node web-editor ./public/compose

# Volume de données persistantes (base SQLite + médias). /data est vide ici,
# le chown est donc instantané (pas de -R sur /app).
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/index.js"]
