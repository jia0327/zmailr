import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  base64ToBytes,
  bytesToBase64,
  buildAttachmentR2Key,
  resolveAttachmentBytes,
} from './r2-attachments';
import type { Attachment } from './types';

describe('r2-attachments', () => {
  it('builds stable R2 keys', () => {
    assert.equal(buildAttachmentR2Key('abc'), 'attachments/abc');
  });

  it('round-trips base64 bytes', () => {
    const original = 'hello world';
    const bytes = new TextEncoder().encode(original);
    const encoded = bytesToBase64(bytes);
    const decoded = base64ToBytes(encoded);
    assert.equal(new TextDecoder().decode(decoded), original);
  });

  it('falls back to D1 content when no R2 bucket', async () => {
    const content = bytesToBase64(new TextEncoder().encode('file-data'));
    const attachment: Attachment = {
      id: 'a1',
      emailId: 'e1',
      filename: 'test.txt',
      mimeType: 'text/plain',
      content,
      size: 9,
      createdAt: 0,
      isLarge: false,
      chunksCount: 0,
      r2Key: 'attachments/a1',
    };
    const bytes = await resolveAttachmentBytes(attachment);
    assert.equal(new TextDecoder().decode(bytes!), 'file-data');
  });
});
