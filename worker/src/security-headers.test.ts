import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySecurityHeaders,
  resolveAdminCspProfile,
  resolveMainCspProfile,
} from './security-headers';

describe('applySecurityHeaders', () => {
  it('sets baseline security response headers', () => {
    const headers = new Headers();
    applySecurityHeaders(headers);
    assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(headers.get('X-Frame-Options'), 'DENY');
    assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.ok(headers.get('Permissions-Policy')?.includes('camera=()'));
    assert.equal(headers.get('Content-Security-Policy'), null);
  });

  it('sets strict CSP for API profile', () => {
    const headers = new Headers();
    applySecurityHeaders(headers, 'api');
    assert.match(headers.get('Content-Security-Policy') ?? '', /default-src 'none'/);
  });

  it('sets SPA CSP with Turnstile origins', () => {
    const headers = new Headers();
    applySecurityHeaders(headers, 'spa');
    const csp = headers.get('Content-Security-Policy') ?? '';
    assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);
  });

  it('sets admin CSP with Turnstile origins', () => {
    const headers = new Headers();
    applySecurityHeaders(headers, 'admin');
    const csp = headers.get('Content-Security-Policy') ?? '';
    assert.match(csp, /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
    assert.match(csp, /frame-src https:\/\/challenges\.cloudflare\.com/);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
    assert.match(csp, /style-src 'unsafe-inline'/);
  });
});

describe('resolveMainCspProfile', () => {
  it('uses api profile for API routes', () => {
    assert.equal(resolveMainCspProfile('/api/health', 'application/json'), 'api');
  });

  it('uses spa profile for dashboard HTML', () => {
    assert.equal(resolveMainCspProfile('/login', 'text/html; charset=utf-8'), 'spa');
  });

  it('skips CSP for VitePress docs HTML', () => {
    assert.equal(resolveMainCspProfile('/docs/', 'text/html; charset=utf-8'), 'none');
  });
});

describe('resolveAdminCspProfile', () => {
  it('uses admin profile for admin HTML', () => {
    assert.equal(resolveAdminCspProfile('/', 'text/html; charset=utf-8'), 'admin');
  });

  it('uses api profile for admin API', () => {
    assert.equal(resolveAdminCspProfile('/api/stats', 'application/json'), 'api');
  });

  it('does not set CSP on admin.js', () => {
    assert.equal(resolveAdminCspProfile('/admin.js', 'application/javascript'), 'none');
  });
});
