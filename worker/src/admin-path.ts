import type { Env } from './types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LEGACY_ADMIN = 'admin';

/** Normalize ADMIN_PATH: no leading/trailing slashes. */
export function normalizeAdminPath(raw: string | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed || null;
}

/**
 * Resolve the admin URL segment from env.
 * Defaults to `admin` when unset (local dev convenience).
 * Production deploys should set ADMIN_PATH to a UUID via GitHub secret / wrangler var.
 */
export function resolveAdminPath(env: Env): string {
  const configured = normalizeAdminPath(env.ADMIN_PATH);
  if (configured) {
    if (configured !== LEGACY_ADMIN && !UUID_RE.test(configured)) {
      console.warn(
        'ADMIN_PATH should be a UUID (e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890); using configured value anyway'
      );
    }
    return configured;
  }
  return LEGACY_ADMIN;
}

export function adminPathPrefix(env: Env): string {
  return `/${resolveAdminPath(env)}`;
}

/** True when request targets the legacy /admin prefix (not the configured secret path). */
export function isLegacyAdminRequest(pathname: string, env: Env): boolean {
  const adminPath = resolveAdminPath(env);
  if (adminPath === LEGACY_ADMIN) return false;
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function isAdminRequest(pathname: string, env: Env): boolean {
  const prefix = adminPathPrefix(env);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Strip configured admin prefix; returns internal path (e.g. `/`, `/api/stats`). */
export function stripAdminPrefix(pathname: string, env: Env): string {
  const prefix = adminPathPrefix(env);
  if (pathname === prefix) return '/';
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length) || '/';
  }
  return pathname;
}
