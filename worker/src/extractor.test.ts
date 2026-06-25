import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchGenericCode, matchWithRegex } from './extractor';

describe('matchGenericCode', () => {
  it('extracts digits after English keywords', () => {
    assert.equal(matchGenericCode('Your verification code: 123456'), '123456');
    assert.equal(matchGenericCode('PIN: 9876'), '9876');
  });

  it('extracts digits after Chinese keyword', () => {
    assert.equal(matchGenericCode('验证码: 556677'), '556677');
  });

  it('returns null when no match', () => {
    assert.equal(matchGenericCode('Hello world'), null);
  });
});

describe('matchWithRegex', () => {
  it('returns first capture group when present', () => {
    assert.equal(matchWithRegex('code is ABC-1234', 'code is ([A-Z0-9-]+)'), 'ABC-1234');
  });

  it('falls back to digit run in full match', () => {
    assert.equal(matchWithRegex('token 888888', 'token \\d+'), '888888');
  });

  it('returns null for invalid regex', () => {
    assert.equal(matchWithRegex('test', '[invalid'), null);
  });
});
