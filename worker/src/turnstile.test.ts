import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTurnstileConfigured,
  verifyTurnstileToken,
  extractTurnstileTokenFromBody,
  assertTurnstileIfEnabled,
} from './turnstile';

describe('isTurnstileConfigured', () => {
  it('is false when keys missing', () => {
    assert.equal(isTurnstileConfigured('', 'secret'), false);
    assert.equal(isTurnstileConfigured('site', ''), false);
    assert.equal(isTurnstileConfigured(null, null), false);
  });

  it('is true when both keys set', () => {
    assert.equal(isTurnstileConfigured('site-key', 'secret-key'), true);
  });
});

describe('extractTurnstileTokenFromBody', () => {
  it('reads turnstileToken and cf-turnstile-response', () => {
    assert.equal(extractTurnstileTokenFromBody({ turnstileToken: ' abc ' }), 'abc');
    assert.equal(extractTurnstileTokenFromBody({ 'cf-turnstile-response': 'xyz' }), 'xyz');
    assert.equal(extractTurnstileTokenFromBody({}), '');
  });
});

describe('assertTurnstileIfEnabled', () => {
  it('passes when Turnstile is disabled', async () => {
    const db = {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
        }),
      }),
    } as unknown as import('@cloudflare/workers-types').D1Database;

    const result = await assertTurnstileIfEnabled(db, {}, new Request('https://x.test'), {});
    assert.equal(result.ok, true);
  });
});

describe('verifyTurnstileToken', () => {
  it('rejects empty token', async () => {
    const result = await verifyTurnstileToken('secret', '');
    assert.equal(result.success, false);
  });

  it('accepts successful siteverify response', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    const result = await verifyTurnstileToken('secret', 'token-abc', '1.2.3.4');
    assert.equal(result.success, true);
    fetchMock.mock.restore();
  });
});
