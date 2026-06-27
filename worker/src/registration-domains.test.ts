import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedRegistrationEmail,
  normalizeRegistrationEmail,
  extractEmailDomain,
  buildRegistrationEmail,
  validateRegistrationLocalPart,
} from './registration-domains';

describe('registration email domains', () => {
  it('accepts major provider domains', () => {
    assert.equal(isAllowedRegistrationEmail('user@qq.com'), true);
    assert.equal(isAllowedRegistrationEmail('user@gmail.com'), true);
    assert.equal(isAllowedRegistrationEmail('user@163.com'), true);
    assert.equal(isAllowedRegistrationEmail('user@outlook.com'), true);
    assert.equal(isAllowedRegistrationEmail('user@icloud.com'), true);
    assert.equal(isAllowedRegistrationEmail('user@sohu.com'), true);
  });

  it('rejects unknown domains', () => {
    assert.equal(isAllowedRegistrationEmail('user@example.com'), false);
    assert.equal(isAllowedRegistrationEmail('user@tempmail.com'), false);
  });

  it('normalizes case and trims', () => {
    assert.equal(normalizeRegistrationEmail('  User@QQ.COM  '), 'user@qq.com');
    assert.equal(extractEmailDomain('User@163.com'), '163.com');
  });

  it('rejects invalid format', () => {
    assert.equal(isAllowedRegistrationEmail('not-an-email'), false);
    assert.equal(isAllowedRegistrationEmail('@qq.com'), false);
  });

  it('builds and validates local part', () => {
    assert.equal(buildRegistrationEmail('User.Name', 'qq.com'), 'user.name@qq.com');
    assert.equal(validateRegistrationLocalPart('user'), null);
    assert.equal(validateRegistrationLocalPart('user@qq.com'), '只需填写 @ 前面的前缀');
    assert.equal(validateRegistrationLocalPart(''), '请输入邮箱前缀');
  });
});
