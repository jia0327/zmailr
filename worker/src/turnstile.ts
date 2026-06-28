import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from './types';
import { getTurnstileSettings } from './database';
import { getClientIp } from './rate-limit';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(siteKey?: string | null, secretKey?: string | null): boolean {
  return !!(siteKey?.trim() && secretKey?.trim());
}

export interface ResolvedTurnstileSettings {
  enabled: boolean;
  siteKey: string | null;
  secretKey: string | null;
}

/** DB 优先，环境变量为回退（兼容旧部署） */
export async function resolveTurnstileSettings(
  db: D1Database,
  env: Pick<Env, 'TURNSTILE_SITE_KEY' | 'TURNSTILE_SECRET_KEY'>
): Promise<ResolvedTurnstileSettings> {
  const stored = await getTurnstileSettings(db);
  const siteKey = (stored.siteKey?.trim() || env.TURNSTILE_SITE_KEY?.trim()) || null;
  const secretKey = (stored.secretKey?.trim() || env.TURNSTILE_SECRET_KEY?.trim()) || null;
  const configured = isTurnstileConfigured(siteKey, secretKey);
  const explicitlyEnabled = stored.enabled || (!stored.siteKey && !stored.secretKey && configured);
  return {
    siteKey,
    secretKey,
    enabled: explicitlyEnabled && configured,
  };
}

export function extractTurnstileTokenFromBody(body: Record<string, unknown>): string {
  if (body.turnstileToken != null) {
    return String(body.turnstileToken).trim();
  }
  if (body['cf-turnstile-response'] != null) {
    return String(body['cf-turnstile-response']).trim();
  }
  return '';
}

export type TurnstileGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** When Turnstile is enabled, require a valid token; otherwise pass through. */
export async function assertTurnstileIfEnabled(
  db: D1Database,
  env: Pick<Env, 'TURNSTILE_SITE_KEY' | 'TURNSTILE_SECRET_KEY'>,
  request: Request,
  body: Record<string, unknown>
): Promise<TurnstileGateResult> {
  const turnstile = await resolveTurnstileSettings(db, env);
  if (!turnstile.enabled || !turnstile.secretKey) {
    return { ok: true };
  }
  const token = extractTurnstileTokenFromBody(body);
  if (!token) {
    return { ok: false, status: 400, error: '请先完成人机验证' };
  }
  const verified = await verifyTurnstileToken(turnstile.secretKey, token, getClientIp(request));
  if (!verified.success) {
    return { ok: false, status: 400, error: '人机验证无效或已过期，请重试' };
  }
  return { ok: true };
}

export async function verifyTurnstileToken(
  secret: string,
  token: string,
  remoteip?: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { success: false, error: 'missing-token' };
  }

  const payload: Record<string, string> = { secret, response: trimmed };
  if (remoteip?.trim()) {
    payload.remoteip = remoteip.trim();
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (data.success) {
      return { success: true };
    }
    const codes = data['error-codes']?.join(',') || 'verification-failed';
    return { success: false, error: codes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
