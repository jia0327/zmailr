import type { D1Database } from '@cloudflare/workers-types';
import { recordRateLimitHit } from './database';
import { getClientIp } from './rate-limit';

export async function logRateLimitHit(
  db: D1Database,
  request: Request,
  userId?: number | null
): Promise<void> {
  try {
    const url = new URL(request.url);
    await recordRateLimitHit(db, {
      ip: getClientIp(request),
      userId: userId ?? null,
      path: url.pathname,
    });
  } catch (error) {
    console.error('记录限流事件失败:', error);
  }
}
