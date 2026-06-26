import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OPENAPI_SPEC } from './openapi';

describe('OPENAPI_SPEC', () => {
  it('covers main public API paths', () => {
    const paths = Object.keys(OPENAPI_SPEC.paths);
    const required = [
      '/api/public/status',
      '/api/config',
      '/api/auth/login',
      '/api/user/quota',
      '/api/user/mailboxes',
      '/api/user/tokens',
      '/api/user/send',
      '/api/user/extract-rules',
      '/api/user/announcements/unread',
      '/api/lease',
      '/api/mailboxes',
      '/api/mail',
      '/api/send',
      '/api/emails/{id}',
      '/api/emails/{id}/raw',
      '/api/emails/{id}/attachments',
      '/api/attachments/{id}',
    ];
    for (const p of required) {
      assert.ok(paths.includes(p), `missing path ${p}`);
    }
  });

  it('defines bearer security scheme', () => {
    assert.equal(OPENAPI_SPEC.components.securitySchemes.bearerAuth.type, 'http');
  });
});
