import { defineConfig } from 'vitest/config';
import path from 'node:path';

const DATA = path.resolve('./.vitest-data');

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.js'],
    globalSetup: './test/globalSetup.js',
    fileParallelism: false, // une seule DB partagée → exécution série
    env: {
      NODE_ENV: 'test',
      DATA_DIR: DATA,
      JWT_SECRET: 'test_jwt_secret_test_jwt_secret_1234',
      ENCRYPTION_KEY: 'test_enc_key_test_enc_key_12345678',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'adminpass123',
      DISCORD_TOKEN: '',
      DISCORD_CLIENT_ID: '',
      LOG_LEVEL: 'error',
      PUBLIC_URL: 'http://localhost:9999',
    },
  },
});
