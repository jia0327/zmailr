import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldTouchTokenLastUsed,
  TOKEN_LAST_USED_TOUCH_INTERVAL_SEC,
  validateExtractRuleInput,
  validateSendFromAddress,
  validateMailDomainHostname,
  extractMailboxName,
  extractEmailDomain,
  buildMailboxEmail,
  generateApiToken,
  API_TOKEN_PREFIX,
} from './utils';
import { MAX_USER_TOKENS } from './types';

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

describe('validateMailDomainHostname', () => {
  it('accepts valid root domain', () => {
    const result = validateMailDomainHostname('mail.example.com');
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.domain, 'mail.example.com');
  });

  it('rejects domain with @', () => {
    const result = validateMailDomainHostname('user@example.com');
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

  it('accepts any domain in allowed list', () => {
    const result = validateSendFromAddress('abc@onlyme.qzz.io', ['itool.eu.cc', 'onlyme.qzz.io']);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.fromEmail, 'abc@onlyme.qzz.io');
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

describe('extractEmailDomain', () => {
  it('returns lowercase domain from email', () => {
    assert.equal(extractEmailDomain('user@OnlyMe.Qzz.io'), 'onlyme.qzz.io');
  });
});

describe('buildMailboxEmail', () => {
  it('joins local part and domain', () => {
    assert.equal(buildMailboxEmail('abc', 'example.com'), 'abc@example.com');
  });
});

describe('extractMailboxName', () => {
  it('returns local-part from full address', () => {
    assert.equal(extractMailboxName('user@example.com'), 'user');
  });

  it('returns input when no @ present', () => {
    assert.equal(extractMailboxName('localonly'), 'localonly');
  });
});

describe('generateApiToken', () => {
  it('uses zmr_ prefix with 64 hex chars', () => {
    const token = generateApiToken();
    assert.match(token, /^zmr_[0-9a-f]{64}$/);
    assert.equal(token.startsWith(API_TOKEN_PREFIX), true);
  });

  it('generates unique values', () => {
    const a = generateApiToken();
    const b = generateApiToken();
    assert.notEqual(a, b);
  });
});

describe('MAX_USER_TOKENS', () => {
  it('allows up to 3 tokens per user', () => {
    assert.equal(MAX_USER_TOKENS, 3);
    assert.equal(2 >= MAX_USER_TOKENS, false);
    assert.equal(3 >= MAX_USER_TOKENS, true);
  });
});
