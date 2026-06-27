import type { Env } from './types';

/** Local Vite / Wrangler dev origins (always allowed). */
const LOCAL_DEV_ORIGINS = [
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function parseDomainList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Build https origins from MAIL_DOMAIN / VITE_EMAIL_DOMAIN entries. */
function originsFromMailDomains(env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN'>): string[] {
  const domains = new Set<string>();
  for (const d of parseDomainList(env.MAIL_DOMAIN)) domains.add(d);
  for (const d of parseDomainList(env.VITE_EMAIL_DOMAIN)) domains.add(d);
  const origins: string[] = [];
  for (const domain of domains) {
    origins.push(`https://${domain}`);
    origins.push(`http://${domain}`);
  }
  return origins;
}

/** Optional comma-separated full origin URLs (e.g. https://app.example.com). */
function originsFromEnvList(raw: string | undefined): string[] {
  return parseDomainList(raw);
}

export function resolveAllowedCorsOrigins(
  env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN' | 'CORS_ALLOWED_ORIGINS'>,
  extraDomains?: string[]
): Set<string> {
  const extraOrigins: string[] = [];
  for (const domain of extraDomains ?? []) {
    extraOrigins.push(`https://${domain}`);
    extraOrigins.push(`http://${domain}`);
  }
  return new Set([
    ...LOCAL_DEV_ORIGINS,
    ...originsFromMailDomains(env),
    ...originsFromEnvList(env.CORS_ALLOWED_ORIGINS),
    ...extraOrigins,
  ]);
}

/**
 * Returns the Origin value to echo in Access-Control-Allow-Origin, or null to deny.
 * Missing Origin (same-origin / non-browser) returns null — no CORS header is set.
 */
export function matchCorsOrigin(
  origin: string | undefined,
  env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN' | 'CORS_ALLOWED_ORIGINS'>,
  extraDomains?: string[]
): string | null {
  if (!origin) return null;
  const allowed = resolveAllowedCorsOrigins(env, extraDomains);
  return allowed.has(origin) ? origin : null;
}
