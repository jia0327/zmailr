import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGlobalIpRateLimitKey } from './rate-limit';

describe('getGlobalIpRateLimitKey', () => {
  it('uses CF-Connecting-IP when present', () => {
    assert.equal(getGlobalIpRateLimitKey('203.0.113.42'), 'ip-global:203.0.113.42');
  });

  it('trims whitespace from IP', () => {
    assert.equal(getGlobalIpRateLimitKey('  203.0.113.42  '), 'ip-global:203.0.113.42');
  });

  it('falls back to unknown when header is missing or blank', () => {
    assert.equal(getGlobalIpRateLimitKey(undefined), 'ip-global:unknown');
    assert.equal(getGlobalIpRateLimitKey(''), 'ip-global:unknown');
    assert.equal(getGlobalIpRateLimitKey('   '), 'ip-global:unknown');
  });
});
