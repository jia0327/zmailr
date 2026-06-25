import { D1Database } from '@cloudflare/workers-types';

export const DEFAULT_RATE_LIMIT = 60;
const WINDOW_MS = 60 * 1000;

const memoryCounters = new Map<string, number>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
}

function minuteBucket(now = Date.now()): number {
  return Math.floor(now / WINDOW_MS);
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

/**
 * Per-minute rate limit with in-memory counter and D1 fallback for cold starts.
 */
export async function consumeRateLimit(
  db: D1Database,
  rateKey: string,
  limit = DEFAULT_RATE_LIMIT
): Promise<RateLimitResult> {
  const bucket = minuteBucket();
  const key = bucketKey(rateKey, bucket);

  if (!memoryCounters.has(key)) {
    const d1Count = await getD1Count(db, key);
    memoryCounters.set(key, d1Count);
  }

  const count = memoryCounters.get(key)!;
  if (count >= limit) {
    return { ok: false, limit, remaining: 0 };
  }

  const newCount = count + 1;
  memoryCounters.set(key, newCount);
  await persistCount(db, key, newCount, bucket);

  return { ok: true, limit, remaining: Math.max(0, limit - newCount) };
}

export function rateLimitHeaders(limit: number, remaining: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
  };
}
