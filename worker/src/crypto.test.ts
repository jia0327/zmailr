import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, hashToken } from './crypto';

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password', async () => {
    const stored = await hashPassword('secret-pass');
    assert.match(stored, /^pbkdf2\$100000\$/);
    assert.equal(await verifyPassword('secret-pass', stored), true);
    assert.equal(await verifyPassword('wrong-pass', stored), false);
  });

  it('rejects malformed stored hashes', async () => {
    assert.equal(await verifyPassword('x', 'invalid'), false);
  });
});

describe('hashToken', () => {
  it('produces deterministic SHA-256 hex', async () => {
    const a = await hashToken('test-token-value');
    const b = await hashToken('test-token-value');
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('differs for different tokens', async () => {
    const a = await hashToken('token-a');
    const b = await hashToken('token-b');
    assert.notEqual(a, b);
  });
});
