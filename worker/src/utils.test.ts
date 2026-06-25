import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSendFromAddress } from './utils';

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
