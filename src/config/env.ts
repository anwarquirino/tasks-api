import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    DB_DRIVER: z.enum(['pg', 'pglite']).default('pg'),
    DATABASE_URL: z
      .url({
        protocol: /^postgres(ql)?$/,
        error: 'DATABASE_URL deve ser uma URL postgres:// ou postgresql:// válida',
      })
      .optional(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/, 'JWT_EXPIRES_IN deve seguir o formato 15m, 1h ou 7d')
      .default('1h'),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    CORS_ORIGIN: z.string().min(1).default('*'),
  })
  .check((ctx) => {
    if (ctx.value.DB_DRIVER === 'pg' && !ctx.value.DATABASE_URL) {
      ctx.issues.push({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL é obrigatória quando DB_DRIVER=pg',
        input: ctx.value.DATABASE_URL,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(problems: string[]) {
    super(`Variáveis de ambiente inválidas:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validates environment variables and returns a typed object.
 * Empty strings are treated as "not set" so `.env` files with blank values
 * fall back to defaults instead of failing validation.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );

  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`,
    );
    throw new EnvValidationError(problems);
  }

  return result.data;
}
