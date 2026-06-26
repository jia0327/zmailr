import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { fetchBrevoAccountSummary } from './brevo-stats';

export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthCheckResult {
  ok: boolean;
  optional?: boolean;
  configured?: boolean;
  message?: string;
}

export interface HealthChecks {
  d1: HealthCheckResult;
  r2: HealthCheckResult;
  brevo: HealthCheckResult;
}

export interface PublicHealthPayload {
  status: HealthStatus;
  checks: HealthChecks;
}

export async function checkD1(db: D1Database): Promise<HealthCheckResult> {
  try {
    await db.prepare('SELECT 1 AS ok').first();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkR2(bucket?: R2Bucket): Promise<HealthCheckResult> {
  if (!bucket) {
    return { ok: false, optional: false, message: 'R2 binding ATTACHMENTS not configured' };
  }
  try {
    await bucket.list({ limit: 1 });
    return { ok: true, optional: false };
  } catch (error) {
    return {
      ok: false,
      optional: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkBrevo(apiKey?: string): Promise<HealthCheckResult> {
  const key = apiKey?.trim();
  if (!key) {
    return { ok: true, configured: false, optional: true };
  }
  const result = await fetchBrevoAccountSummary(key);
  if (result.ok) {
    return { ok: true, configured: true, optional: true };
  }
  return {
    ok: false,
    configured: true,
    optional: true,
    message: result.error,
  };
}

export function aggregateHealthStatus(checks: HealthChecks): HealthStatus {
  if (!checks.d1.ok || !checks.r2.ok) {
    return 'error';
  }
  if (checks.brevo.configured && !checks.brevo.ok) {
    return 'degraded';
  }
  return 'ok';
}

export async function runHealthChecks(env: {
  DB: D1Database;
  ATTACHMENTS?: R2Bucket;
  BREVO_API_KEY?: string;
}): Promise<PublicHealthPayload> {
  const [d1, r2, brevo] = await Promise.all([
    checkD1(env.DB),
    checkR2(env.ATTACHMENTS),
    checkBrevo(env.BREVO_API_KEY),
  ]);
  const checks = { d1, r2, brevo };
  return {
    status: aggregateHealthStatus(checks),
    checks,
  };
}
