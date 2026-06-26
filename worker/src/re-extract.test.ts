import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RE_EXTRACT_BATCH_LIMIT,
  buildReExtractBatchOpts,
} from './re-extract';
import { stripHtml } from './email-handler';

describe('buildReExtractBatchOpts', () => {
  it('returns null when rule is disabled', () => {
    assert.equal(
      buildReExtractBatchOpts({ domain: 'npmjs.com', enabled: false }),
      null
    );
  });

  it('scopes user rules to userId', () => {
    assert.deepEqual(buildReExtractBatchOpts({ userId: 42, domain: '*' }), {
      userId: 42,
      limit: RE_EXTRACT_BATCH_LIMIT,
    });
  });

  it('adds domain filter for specific domains', () => {
    assert.deepEqual(buildReExtractBatchOpts({ domain: 'npmjs.com' }), {
      limit: RE_EXTRACT_BATCH_LIMIT,
      domain: 'npmjs.com',
    });
  });

  it('omits domain filter for wildcard global rules', () => {
    assert.deepEqual(buildReExtractBatchOpts({ domain: '*' }), {
      limit: RE_EXTRACT_BATCH_LIMIT,
    });
  });
});

describe('stripHtml (re-extract body)', () => {
  it('strips tags and decodes common entities', () => {
    const text = stripHtml('<p>The OTP code is: <b>123456</b></p>');
    assert.match(text, /123456/);
  });
});
