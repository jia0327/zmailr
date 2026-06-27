import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertMailboxAccess, canSendFromMailbox } from './auth';
import type { ApiAuthContext, Mailbox, User } from './types';
import { DEFAULT_LEGACY_SEND_DAILY_QUOTA } from './types';

const ownedMailbox: Mailbox = {
  id: 'mb-1',
  address: 'abc123',
  createdAt: 0,
  expiresAt: 9999999999,
  ipAddress: '127.0.0.1',
  lastAccessed: 0,
  userId: 42,
};

const legacyMailbox: Mailbox = {
  ...ownedMailbox,
  id: 'mb-legacy',
  userId: null,
};

const owner: User = {
  id: 42,
  username: 'alice',
  role: 'user',
  dailySendQuota: 50,
  rateLimitPerMin: 60,
  rateLimitBurst: null,
  enabled: true,
  createdAt: 0,
  lastLoginAt: null,
};

const otherUser: User = {
  ...owner,
  id: 99,
  username: 'bob',
};

const adminUser: User = {
  ...owner,
  id: 1,
  username: 'admin',
  role: 'admin',
};

const userAuth: ApiAuthContext = {
  type: 'user',
  userId: 42,
  tokenId: 1,
  scopes: ['mail'],
  dailySendQuota: 50,
};

const legacyAuth: ApiAuthContext = {
  type: 'legacy',
  scopes: ['lease', 'mail', 'send'],
};

describe('assertMailboxAccess', () => {
  it('allows owner session on user-owned mailbox', () => {
    assert.equal(assertMailboxAccess(ownedMailbox, { user: owner }), true);
  });

  it('denies other user session on user-owned mailbox', () => {
    assert.equal(assertMailboxAccess(ownedMailbox, { user: otherUser }), false);
  });

  it('allows matching bearer user on user-owned mailbox', () => {
    assert.equal(assertMailboxAccess(ownedMailbox, { auth: userAuth }), true);
  });

  it('denies bearer user with wrong user_id', () => {
    assert.equal(
      assertMailboxAccess(ownedMailbox, { auth: { ...userAuth, userId: 99 } }),
      false
    );
  });

  it('allows legacy bearer on legacy mailbox', () => {
    assert.equal(assertMailboxAccess(legacyMailbox, { auth: legacyAuth }), true);
  });

  it('allows admin session on legacy mailbox', () => {
    assert.equal(assertMailboxAccess(legacyMailbox, { user: adminUser }), true);
  });

  it('denies regular user session on legacy mailbox', () => {
    assert.equal(assertMailboxAccess(legacyMailbox, { user: owner }), false);
  });

  it('denies unauthenticated access', () => {
    assert.equal(assertMailboxAccess(ownedMailbox, {}), false);
  });
});

describe('canSendFromMailbox', () => {
  it('allows user token on owned mailbox', () => {
    assert.equal(canSendFromMailbox(ownedMailbox, 'user', 42).ok, true);
  });

  it('denies user token on legacy mailbox', () => {
    assert.equal(canSendFromMailbox(legacyMailbox, 'user', 42).ok, false);
  });

  it('allows legacy token on unowned mailbox', () => {
    assert.equal(canSendFromMailbox(legacyMailbox, 'legacy', null).ok, true);
  });
});

describe('DEFAULT_LEGACY_SEND_DAILY_QUOTA', () => {
  it('defaults to 50', () => {
    assert.equal(DEFAULT_LEGACY_SEND_DAILY_QUOTA, 50);
  });
});
