import { sql } from 'drizzle-orm';
import { Router } from 'express';
import type { Database } from '../../db/index.js';

type DatabaseStatus = 'up' | 'down';

async function checkDatabase(db: Database): Promise<DatabaseStatus> {
  try {
    await db.execute(sql`select 1`);
    return 'up';
  } catch {
    return 'down';
  }
}

export function createHealthRouter(db: Database): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const database = await checkDatabase(db);
    if (database === 'down') req.log.error('Banco de dados indisponível no health check');

    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
