import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertMailboxAccess, canSendFromMailbox, resolveSessionSecret } from './auth';
import {
  DEFAULT_DAILY_LEASE_QUOTA,
  type ApiAuthContext,
  type Env,
  type Mailbox,
  type User,
} from './types';

const ownedMailbox: Mailbox = {
  id: 'mb-1',
  address: 'abc123',
  createdAt: 0,
  expiresAt: 9999999999,
  ipAddress: '127.0.0.1',
  lastAccessed: 0,
  userId: 42,
};

const orphanMailbox: Mailbox = {
  ...ownedMailbox,
  id: 'mb-orphan',
  userId: null,
};

const owner: User = {
  id: 42,
  username: 'alice',
  role: 'user',
  dailySendQuota: 50,
  dailyLeaseQuota: DEFAULT_DAILY_LEASE_QUOTA,
  sessionVersion: 0,
  rateLimitPerMin: 60,
  rateLimitBurst: null,
  maxUserTokens: 3,
  enabled: true,
  createdAt: 0,
  lastLoginAt: null,
};

const otherUser: User = {
  ...owner,
  id: 99,
  username: 'bob',
};

const userAuth: ApiAuthContext = {
  userId: 42,
  tokenId: 1,
  scopes: ['mail'],
  dailySendQuota: 50,
  dailyLeaseQuota: DEFAULT_DAILY_LEASE_QUOTA,
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

  it('denies access to orphan mailboxes without user_id', () => {
    assert.equal(assertMailboxAccess(orphanMailbox, { auth: userAuth }), false);
    assert.equal(assertMailboxAccess(orphanMailbox, { user: owner }), false);
  });

  it('denies unauthenticated access', () => {
    assert.equal(assertMailboxAccess(ownedMailbox, {}), false);
  });
});

describe('canSendFromMailbox', () => {
  it('allows user on owned mailbox', () => {
    assert.equal(canSendFromMailbox(ownedMailbox, 42).ok, true);
  });

  it('denies user on orphan mailbox', () => {
    assert.equal(canSendFromMailbox(orphanMailbox, 42).ok, false);
  });
});

describe('resolveSessionSecret', () => {
  it('returns SESSION_SECRET when configured', () => {
    const env = { SESSION_SECRET: 'session-key', ADMIN_PASSWORD: 'admin-key' } as Env;
    assert.equal(resolveSessionSecret(env), 'session-key');
  });

  it('does not fall back to ADMIN_PASSWORD', () => {
    const env = { ADMIN_PASSWORD: 'admin-key' } as Env;
    assert.equal(resolveSessionSecret(env), null);
  });

  it('returns null when SESSION_SECRET is unset', () => {
    assert.equal(resolveSessionSecret({} as Env), null);
  });
});
