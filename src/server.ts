import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './lib/logger.js';

loadDotenv({ quiet: true });

function main(): void {
  const env = loadEnv();
  const logger = createLogger(env);
  const app = createApp({ env, logger });

  const server = app.listen(env.PORT, () => {
    logger.info(`Servidor ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'Encerrando servidor');
    server.close(() => {
      logger.info('Servidor encerrado');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
