import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDb } from './db/index.js';
import { createLogger } from './lib/logger.js';

loadDotenv({ quiet: true });

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  const database = await createDb(env);
  if (database.driver === 'pglite') {
    // In-memory database: nothing persists, so migrations must run on every boot.
    await database.migrate();
    logger.warn('Usando PGlite em memória: os dados são descartados ao encerrar o processo');
  }

  const app = createApp({ env, db: database.db, logger });

  const server = app.listen(env.PORT, () => {
    logger.info(`Servidor ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'Encerrando servidor');
    server.close(() => {
      database
        .close()
        .catch((err: unknown) => logger.error({ err }, 'Falha ao fechar conexão com o banco'))
        .finally(() => {
          logger.info('Servidor encerrado');
          process.exit(0);
        });
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
