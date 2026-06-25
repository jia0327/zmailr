import type { Env, BrevoAccountSummary } from './types';

interface BrevoAccountResponse {
  email?: string;
  plan?: Array<{ type?: string; creditsType?: string; credits?: number }>;
  planVerticals?: Array<{ planCategory?: string; planType?: string; credits?: number }>;
}

/**
 * Fetches Brevo account plan/credits via GET /v3/account.
 * @see https://developers.brevo.com/reference/get-account
 */
export async function fetchBrevoAccountSummary(
  apiKey: string
): Promise<{ ok: true; summary: BrevoAccountSummary } | { ok: false; error: string }> {
  try {
    const response = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { ok: false, error: `Brevo API ${response.status}${text ? `: ${text.slice(0, 120)}` : ''}` };
    }
    const data = (await response.json()) as BrevoAccountResponse;
    const planEntry = data.plan?.[0];
    const planType =
      planEntry?.type ||
      data.planVerticals?.find((p) => p.planCategory === 'email')?.planType ||
      'unknown';
    return {
      ok: true,
      summary: {
        email: data.email ?? '',
        planType,
        credits: planEntry?.credits ?? data.plan ?? data.planVerticals ?? null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchBrevoAccountIfConfigured(
  env: Pick<Env, 'BREVO_API_KEY'>
): Promise<{ ok: true; summary: BrevoAccountSummary } | { ok: false; error: string } | null> {
  const key = env.BREVO_API_KEY?.trim();
  if (!key) return null;
  return fetchBrevoAccountSummary(key);
}
