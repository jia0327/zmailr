import { D1Database } from '@cloudflare/workers-types';
import type { Env } from './types';

export const WINDOW_MS = 60 * 1000;
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;

export const DEFAULT_TOKEN_RATE_LIMIT = 60;
export const DEFAULT_SESSION_RATE_LIMIT = 120;
export const DEFAULT_IP_MAILBOX_CREATE_LIMIT = 20;
export const DEFAULT_IP_PUBLIC_READ_LIMIT = 60;
export const DEFAULT_IP_DELETE_LIMIT = 60;
export const DEFAULT_IP_LOGIN_LIMIT = 10;
export const DEFAULT_LOGIN_FAIL_MAX = 5;
export const DEFAULT_ADMIN_RATE_LIMIT = 120;
export const DEFAULT_IP_GENERAL_LIMIT = 120;

/** Shared per-IP bucket for all /api/* and /admin/api/* routes. */
export const DEFAULT_GLOBAL_IP_RATE_LIMIT = 60;

/** @deprecated use DEFAULT_GLOBAL_IP_RATE_LIMIT */
export const DEFAULT_RATE_LIMIT = DEFAULT_GLOBAL_IP_RATE_LIMIT;

/** Key: ip-global:{CF-Connecting-IP}, fallback ip-global:unknown */
export function getGlobalIpRateLimitKey(cfConnectingIp: string | undefined): string {
  const ip = cfConnectingIp?.trim();
  return `ip-global:${ip || 'unknown'}`;
}

const memoryCounters = new Map<string, number>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}

export interface LoginRateLimitResult extends RateLimitResult {
  locked: boolean;
}

function minuteBucket(now = Date.now(), windowMs = WINDOW_MS): number {
  return Math.floor(now / windowMs);
}

function bucketKey(rateKey: string, bucket: number): string {
  return `${rateKey}:${bucket}`;
}

async function getD1Count(db: D1Database, key: string): Promise<number> {
  const row = await db
    .prepare(`SELECT count FROM api_rate_limits WHERE key = ?`)
    .bind(key)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

async function persistCount(db: D1Database, key: string, count: number, bucket: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO api_rate_limits (key, count, window_start) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start`
    )
    .bind(key, count, bucket)
    .run();
}

export function retryAfterSeconds(now = Date.now(), windowMs = WINDOW_MS): number {
  const bucket = minuteBucket(now, windowMs);
  const bucketEnd = (bucket + 1) * windowMs;
  return Math.max(1, Math.ceil((bucketEnd - now) / 1000));
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export function resolveTokenRateLimit(env?: Pick<Env, 'RATE_LIMIT_PER_MIN'>): number {
  const parsed = parseInt(env?.RATE_LIMIT_PER_MIN ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOKEN_RATE_LIMIT;
}

export function rateLimitHeaders(result: Pick<RateLimitResult, 'limit' | 'remaining' | 'retryAfter'>): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'Retry-After': String(result.retryAfter),
  };
}

export function rateLimitExceededBody(locked = false): { success: false; error: 'rate_limit'; message: string } {
  return {
    success: false,
    error: 'rate_limit',
    message: locked ? '登录失败次数过多，请稍后再试' : '请求过于频繁，请稍后再试',
  };
}

/** Reset in-memory counters (tests only). */
export function resetRateLimitMemoryForTests(): void {
  memoryCounters.clear();
}

async function loadCount(db: D1Database, key: string): Promise<number> {
  if (!memoryCounters.has(key)) {
    memoryCounters.set(key, await getD1Count(db, key));
  }
  return memoryCounters.get(key)!;
}

/**
 * Per-window rate limit with in-memory counter and D1 persistence for cold starts.
 */
export async function consumeRateLimit(
  db: D1Database,
  rateKey: string,
  limit = DEFAULT_TOKEN_RATE_LIMIT,
  windowMs = WINDOW_MS
): Promise<RateLimitResult> {
  const bucket = minuteBucket(undefined, windowMs);
  const key = bucketKey(rateKey, bucket);
  const count = await loadCount(db, key);
  const retryAfter = retryAfterSeconds(undefined, windowMs);

  if (count >= limit) {
    return { ok: false, limit, remaining: 0, retryAfter };
  }

  const newCount = count + 1;
  memoryCounters.set(key, newCount);
  await persistCount(db, key, newCount, bucket);

  return { ok: true, limit, remaining: Math.max(0, limit - newCount), retryAfter };
}

async function peekRateLimit(
  db: D1Database,
  rateKey: string,
  limit: number,
  windowMs = WINDOW_MS
): Promise<RateLimitResult> {
  const bucket = minuteBucket(undefined, windowMs);
  const key = bucketKey(rateKey, bucket);
  const count = await loadCount(db, key);
  const retryAfter = retryAfterSeconds(undefined, windowMs);
  const remaining = Math.max(0, limit - count);
  return { ok: count < limit, limit, remaining, retryAfter };
}

function loginKeys(ip: string, prefix = 'login') {
  return {
    fail: `${prefix}-fail:ip:${ip}`,
    attempt: `${prefix}-attempt:ip:${ip}`,
  };
}

export async function checkLoginRateLimit(
  db: D1Database,
  ip: string,
  prefix = 'login'
): Promise<LoginRateLimitResult> {
  const keys = loginKeys(ip, prefix);
  const failPeek = await peekRateLimit(db, keys.fail, DEFAULT_LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MS);
  if (!failPeek.ok) {
    return { ...failPeek, locked: true };
  }

  const attempt = await peekRateLimit(db, keys.attempt, DEFAULT_IP_LOGIN_LIMIT);
  if (!attempt.ok) {
    return { ...attempt, locked: false };
  }

  return { ...attempt, locked: false };
}

export async function consumeLoginAttempt(
  db: D1Database,
  ip: string,
  prefix = 'login'
): Promise<LoginRateLimitResult> {
  const lockCheck = await checkLoginRateLimit(db, ip, prefix);
  if (!lockCheck.ok) {
    return lockCheck;
  }

  const keys = loginKeys(ip, prefix);
  const attempt = await consumeRateLimit(db, keys.attempt, DEFAULT_IP_LOGIN_LIMIT);
  return { ...attempt, locked: false };
}

export async function recordLoginFailure(
  db: D1Database,
  ip: string,
  prefix = 'login'
): Promise<void> {
  const keys = loginKeys(ip, prefix);
  await consumeRateLimit(db, keys.fail, DEFAULT_LOGIN_FAIL_MAX, LOGIN_FAIL_WINDOW_MS);
}

export async function clearLoginFailures(
  db: D1Database,
  ip: string,
  prefix = 'login'
): Promise<void> {
  const keys = loginKeys(ip, prefix);
  const bucket = minuteBucket(undefined, LOGIN_FAIL_WINDOW_MS);
  const key = bucketKey(keys.fail, bucket);
  memoryCounters.delete(key);
  await db.prepare(`DELETE FROM api_rate_limits WHERE key = ?`).bind(key).run();
}

export type IpRateLimitCategory =
  | 'mailbox_create'
  | 'public_read'
  | 'delete'
  | 'general';

export function ipRateLimitForCategory(category: IpRateLimitCategory): number {
  switch (category) {
    case 'mailbox_create':
      return DEFAULT_IP_MAILBOX_CREATE_LIMIT;
    case 'public_read':
      return DEFAULT_IP_PUBLIC_READ_LIMIT;
    case 'delete':
      return DEFAULT_IP_DELETE_LIMIT;
    default:
      return DEFAULT_IP_GENERAL_LIMIT;
  }
}

export async function consumeIpRateLimit(
  db: D1Database,
  ip: string,
  category: IpRateLimitCategory
): Promise<RateLimitResult> {
  const limit = ipRateLimitForCategory(category);
  return consumeRateLimit(db, `ip:${category}:${ip}`, limit);
}
