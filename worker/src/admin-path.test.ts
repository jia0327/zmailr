import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAdminPath,
  normalizeAdminPath,
  isLegacyAdminRequest,
  isAdminRequest,
  stripAdminPrefix,
  adminPathPrefix,
} from './admin-path';
import type { Env } from './types';

const env = (overrides: Partial<Env> = {}): Env =>
  ({ DB: {} as Env['DB'], ...overrides }) as Env;

describe('resolveAdminPath', () => {
  it('defaults to admin when unset', () => {
    assert.equal(resolveAdminPath(env()), 'admin');
  });

  it('uses configured ADMIN_PATH without slashes', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    assert.equal(resolveAdminPath(env({ ADMIN_PATH: uuid })), uuid);
    assert.equal(resolveAdminPath(env({ ADMIN_PATH: `/${uuid}/` })), uuid);
  });
});

describe('normalizeAdminPath', () => {
  it('returns null for empty values', () => {
    assert.equal(normalizeAdminPath(undefined), null);
    assert.equal(normalizeAdminPath('   '), null);
    assert.equal(normalizeAdminPath('/'), null);
  });
});

describe('admin path matching', () => {
  const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const secretEnv = env({ ADMIN_PATH: uuid });

  it('detects legacy /admin when secret path is set', () => {
    assert.equal(isLegacyAdminRequest('/admin', secretEnv), true);
    assert.equal(isLegacyAdminRequest('/admin/login', secretEnv), true);
    assert.equal(isLegacyAdminRequest('/administrator', secretEnv), false);
  });

  it('does not treat /admin as legacy when path is admin', () => {
    assert.equal(isLegacyAdminRequest('/admin', env()), false);
  });

  it('matches configured admin prefix', () => {
    assert.equal(isAdminRequest(`/${uuid}`, secretEnv), true);
    assert.equal(isAdminRequest(`/${uuid}/api/stats`, secretEnv), true);
    assert.equal(isAdminRequest('/admin', secretEnv), false);
  });

  it('strips admin prefix for internal routing', () => {
    assert.equal(stripAdminPrefix(`/${uuid}`, secretEnv), '/');
    assert.equal(stripAdminPrefix(`/${uuid}/api/stats`, secretEnv), '/api/stats');
    assert.equal(adminPathPrefix(secretEnv), `/${uuid}`);
  });
});
