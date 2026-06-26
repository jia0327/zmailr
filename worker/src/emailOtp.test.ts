import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractRuleUrl, extractRulesUrl, extractSenderDomain, isVerificationLikeSubject } from '../../frontend/src/utils/emailOtp';

describe('emailOtp utils', () => {
  it('extracts sender domain from angle-addr and plain email', () => {
    assert.equal(extractSenderDomain('Acme <noreply@example.com>'), 'example.com');
    assert.equal(extractSenderDomain('user@mail.test'), 'mail.test');
    assert.equal(extractSenderDomain('invalid'), null);
  });

  it('detects verification-like subjects', () => {
    assert.equal(isVerificationLikeSubject('Your OTP is ready'), true);
    assert.equal(isVerificationLikeSubject('Please verify your account'), true);
    assert.equal(isVerificationLikeSubject('您的验证码'), true);
    assert.equal(isVerificationLikeSubject('Newsletter'), false);
  });

  it('builds extract rules URL with domain query', () => {
    assert.equal(extractRulesUrl('example.com'), '/dashboard/extract-rules?domain=example.com');
    assert.equal(extractRulesUrl(null), '/dashboard/extract-rules');
  });

  it('builds extract rules URL with rule id', () => {
    assert.equal(extractRuleUrl(4), '/dashboard/extract-rules?ruleId=4');
  });
});
