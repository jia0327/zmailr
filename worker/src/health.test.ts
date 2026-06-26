import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateHealthStatus } from './health';

describe('aggregateHealthStatus', () => {
  it('returns ok when required checks pass and Brevo is skipped', () => {
    assert.equal(
      aggregateHealthStatus({
        d1: { ok: true },
        r2: { ok: true, optional: false },
        brevo: { ok: true, configured: false, optional: true },
      }),
      'ok'
    );
  });

  it('returns degraded when Brevo is configured but unreachable', () => {
    assert.equal(
      aggregateHealthStatus({
        d1: { ok: true },
        r2: { ok: true, optional: false },
        brevo: { ok: false, configured: true, optional: true, message: 'Brevo API 401' },
      }),
      'degraded'
    );
  });

  it('returns error when D1 fails', () => {
    assert.equal(
      aggregateHealthStatus({
        d1: { ok: false, message: 'db down' },
        r2: { ok: true, optional: false },
        brevo: { ok: true, configured: false, optional: true },
      }),
      'error'
    );
  });

  it('returns error when R2 fails', () => {
    assert.equal(
      aggregateHealthStatus({
        d1: { ok: true },
        r2: { ok: false, optional: false, message: 'r2 down' },
        brevo: { ok: true, configured: true, optional: true },
      }),
      'error'
    );
  });
});
