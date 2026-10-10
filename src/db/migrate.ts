import { config as loadDotenv } from 'dotenv';
import { loadEnv } from '../config/env.js';
import { createLogger } from '../lib/logger.js';
import { createDb } from './index.js';

loadDotenv({ quiet: true });

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const database = await createDb(env);

  try {
    logger.info({ driver: database.driver }, 'Aplicando migrations');
    await database.migrate();
    logger.info('Migrations aplicadas com sucesso');
  } finally {
    await database.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
