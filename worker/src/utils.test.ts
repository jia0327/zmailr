import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldTouchTokenLastUsed, TOKEN_LAST_USED_TOUCH_INTERVAL_SEC, validateExtractRuleInput, validateSendFromAddress } from './utils';

describe('shouldTouchTokenLastUsed', () => {
  it('touches when last_used_at is null', () => {
    assert.equal(shouldTouchTokenLastUsed(null, 1000), true);
  });

  it('touches when interval has elapsed', () => {
    const now = 5000;
    const last = now - TOKEN_LAST_USED_TOUCH_INTERVAL_SEC;
    assert.equal(shouldTouchTokenLastUsed(last, now), true);
  });

  it('skips touch within interval', () => {
    const now = 5000;
    const last = now - TOKEN_LAST_USED_TOUCH_INTERVAL_SEC + 1;
    assert.equal(shouldTouchTokenLastUsed(last, now), false);
  });
});

describe('validateExtractRuleInput', () => {
  it('accepts wildcard domain and valid regex', () => {
    const result = validateExtractRuleInput({ domain: '*', regex: '(\\d{6})' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.domain, '*');
      assert.equal(result.regex, '(\\d{6})');
    }
  });

  it('normalizes domain to lowercase', () => {
    const result = validateExtractRuleInput({ domain: 'Example.COM', regex: '\\d+' });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.domain, 'example.com');
  });

  it('rejects invalid regex', () => {
    const result = validateExtractRuleInput({ domain: '*', regex: '[invalid' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /正则/);
  });

  it('rejects invalid domain', () => {
    const result = validateExtractRuleInput({ domain: 'not a domain!', regex: '\\d+' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /域名/);
  });

  it('rejects empty regex', () => {
    const result = validateExtractRuleInput({ domain: '*', regex: '  ' });
    assert.equal(result.ok, false);
  });
});

describe('validateSendFromAddress', () => {
  it('accepts a valid mailbox on the configured domain', () => {
    const result = validateSendFromAddress('abc123@itool.eu.cc', 'itool.eu.cc');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.localPart, 'abc123');
      assert.equal(result.fromEmail, 'abc123@itool.eu.cc');
    }
  });

  it('rejects addresses on other domains', () => {
    const result = validateSendFromAddress('abc123@evil.com', 'itool.eu.cc');
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /域名/);
    }
  });

  it('rejects local-part-only input', () => {
    const result = validateSendFromAddress('abc123', 'itool.eu.cc');
    assert.equal(result.ok, false);
  });

  it('matches domain case-insensitively', () => {
    const result = validateSendFromAddress('abc123@ITOOL.eu.cc', 'itool.eu.cc');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.fromEmail, 'abc123@itool.eu.cc');
    }
  });
});
