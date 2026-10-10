const UNIQUE_VIOLATION = '23505';

/**
 * Drizzle wraps driver errors in DrizzleQueryError and keeps the original
 * PostgreSQL error (with its SQLSTATE `code`) in `cause`. Both node-postgres
 * and PGlite expose the code the same way.
 */
function getSqlState(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;

  const candidate = 'cause' in err ? err.cause : err;
  if (typeof candidate === 'object' && candidate !== null && 'code' in candidate) {
    return typeof candidate.code === 'string' ? candidate.code : undefined;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return getSqlState(err) === UNIQUE_VIOLATION;
}
