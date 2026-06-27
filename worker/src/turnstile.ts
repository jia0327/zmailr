import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from './types';
import { getRegistrationSettings } from './database';

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
  const reg = await getRegistrationSettings(db);
  const siteKey = (reg.turnstileSiteKey?.trim() || env.TURNSTILE_SITE_KEY?.trim()) || null;
  const secretKey = (reg.turnstileSecretKey?.trim() || env.TURNSTILE_SECRET_KEY?.trim()) || null;
  return {
    siteKey,
    secretKey,
    enabled: isTurnstileConfigured(siteKey, secretKey),
  };
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
