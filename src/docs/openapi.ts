import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Resolves to <project>/openapi.yaml both from src/docs (tsx) and dist/docs (build).
const OPENAPI_PATH = fileURLToPath(new URL('../../openapi.yaml', import.meta.url));

export interface OpenApiDocument {
  /** Original YAML text, served as-is. */
  raw: string;
  /** Parsed document handed to Swagger UI. */
  document: Record<string, unknown>;
}

export function loadOpenApiDocument(): OpenApiDocument {
  const raw = readFileSync(OPENAPI_PATH, 'utf8');
  return { raw, document: parse(raw) as Record<string, unknown> };
}
