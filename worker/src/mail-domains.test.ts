import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickRandomFromList } from './mail-domains';

describe('pickRandomFromList', () => {
  it('returns undefined for empty list', () => {
    assert.equal(pickRandomFromList([]), undefined);
  });

  it('returns the only item', () => {
    assert.equal(pickRandomFromList(['a.example.com']), 'a.example.com');
  });

  it('picks by injected random', () => {
    const domains = ['a.com', 'b.com', 'c.com'];
    assert.equal(pickRandomFromList(domains, () => 0), 'a.com');
    assert.equal(pickRandomFromList(domains, () => 0.99), 'c.com');
    assert.equal(pickRandomFromList(domains, () => 0.5), 'b.com');
  });
});
