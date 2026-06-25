import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPathBlockedByMaintenance,
  pathMatchesMaintenanceBlock,
  maintenanceBlockedBody,
} from './maintenance';
import { DEFAULT_MAINTENANCE_MODE } from './types';

describe('pathMatchesMaintenanceBlock', () => {
  it('blocks lease on POST /api/lease', () => {
    assert.equal(pathMatchesMaintenanceBlock('/api/lease', 'POST', 'lease'), true);
    assert.equal(pathMatchesMaintenanceBlock('/api/lease', 'GET', 'lease'), false);
  });

  it('blocks send routes', () => {
    assert.equal(pathMatchesMaintenanceBlock('/api/send', 'POST', 'send'), true);
    assert.equal(pathMatchesMaintenanceBlock('/api/user/send', 'POST', 'send'), true);
  });

  it('blocks mailbox create routes', () => {
    assert.equal(pathMatchesMaintenanceBlock('/api/user/mailboxes', 'POST', 'mailboxCreate'), true);
    assert.equal(pathMatchesMaintenanceBlock('/api/lease', 'POST', 'mailboxCreate'), true);
  });
});

describe('isPathBlockedByMaintenance', () => {
  it('does nothing when maintenance disabled', () => {
    assert.equal(
      isPathBlockedByMaintenance('/api/send', 'POST', { ...DEFAULT_MAINTENANCE_MODE, enabled: false }),
      false
    );
  });

  it('blocks send when enabled and blockSend set', () => {
    assert.equal(
      isPathBlockedByMaintenance('/api/user/send', 'POST', {
        ...DEFAULT_MAINTENANCE_MODE,
        enabled: true,
        blockSend: true,
        blockLease: false,
        blockMailboxCreate: false,
      }),
      true
    );
  });

  it('respects individual block flags', () => {
    const mode = {
      enabled: true,
      message: '维护中',
      blockLease: false,
      blockSend: false,
      blockMailboxCreate: true,
    };
    assert.equal(isPathBlockedByMaintenance('/api/lease', 'POST', mode), true);
    assert.equal(isPathBlockedByMaintenance('/api/send', 'POST', mode), false);
  });
});

describe('maintenanceBlockedBody', () => {
  it('uses custom message when provided', () => {
    const body = maintenanceBlockedBody({ ...DEFAULT_MAINTENANCE_MODE, enabled: true, message: ' 升级中  ' });
    assert.equal(body.error, 'maintenance');
    assert.equal(body.message, '升级中');
  });

  it('falls back to default message', () => {
    const body = maintenanceBlockedBody({ ...DEFAULT_MAINTENANCE_MODE, enabled: true, message: '' });
    assert.match(body.message, /维护/);
  });
});
