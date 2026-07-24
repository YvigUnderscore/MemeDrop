import http from 'node:http';

import { config } from './config.js';
import { logger } from './logger.js';
import { ensureAdmin } from './auth.js';
import { createApp } from './app.js';
import { initWebSocket } from './wsHub.js';
import { startAllBots } from './discordManager.js';
import { startRetentionJob } from './retention.js';
import { startSchedulerJob } from './scheduler.js';
import { startHallArchiveJob } from './hallArchive.js';

const app = createApp();

// --- Démarrage ----------------------------------------------------------
const server = http.createServer(app);
initWebSocket(server);

ensureAdmin();
server.listen(config.port, () => {
  logger.info(`MemeBomb serveur démarré sur ${config.publicUrl} (port ${config.port})`);
  startAllBots().catch((e) => logger.error('Démarrage des bots:', e.message));
  startRetentionJob();
  startSchedulerJob();
  startHallArchiveJob();
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { logger.info(`Signal ${sig}, arrêt...`); server.close(() => process.exit(0)); });
}
