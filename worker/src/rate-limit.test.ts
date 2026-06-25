import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_USER_RATE_LIMIT,
  RATE_LIMIT_PLANS,
  effectiveRateLimitMax,
  getGlobalIpRateLimitKey,
  getUserRateLimitKey,
  rateLimitHeaders,
  resolveUserRateLimits,
} from './rate-limit';

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

describe('getUserRateLimitKey', () => {
  it('scopes counters by user id', () => {
    assert.equal(getUserRateLimitKey(42), 'user:42');
  });
});

describe('resolveUserRateLimits', () => {
  it('defaults null limit to 60/min with no burst', () => {
    assert.deepEqual(resolveUserRateLimits({ rateLimitPerMin: null, rateLimitBurst: null }), {
      limit: DEFAULT_USER_RATE_LIMIT,
      burst: null,
    });
  });

  it('uses configured limit and burst', () => {
    assert.deepEqual(resolveUserRateLimits({ rateLimitPerMin: 600, rateLimitBurst: 30 }), {
      limit: 600,
      burst: 30,
    });
  });

  it('treats zero burst as disabled', () => {
    assert.deepEqual(resolveUserRateLimits({ rateLimitPerMin: 60, rateLimitBurst: 0 }), {
      limit: 60,
      burst: null,
    });
  });
});

describe('effectiveRateLimitMax', () => {
  it('adds burst headroom to sustained limit', () => {
    assert.equal(effectiveRateLimitMax(600, 30), 630);
    assert.equal(effectiveRateLimitMax(60, null), 60);
  });
});

describe('RATE_LIMIT_PLANS', () => {
  it('matches product tiers', () => {
    assert.deepEqual(RATE_LIMIT_PLANS.free, { limit: 60, burst: null });
    assert.deepEqual(RATE_LIMIT_PLANS.pro, { limit: 600, burst: 30 });
    assert.deepEqual(RATE_LIMIT_PLANS.team, { limit: 3000, burst: 200 });
  });
});

describe('rateLimitHeaders', () => {
  it('includes limit, remaining, reset, and retry-after', () => {
    const headers = rateLimitHeaders({ limit: 600, remaining: 599, retryAfter: 45 });
    assert.equal(headers['X-RateLimit-Limit'], '600');
    assert.equal(headers['X-RateLimit-Remaining'], '599');
    assert.equal(headers['Retry-After'], '45');
    assert.match(headers['X-RateLimit-Reset'], /^\d+$/);
  });
});
