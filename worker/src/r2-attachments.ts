import type { R2Bucket } from '@cloudflare/workers-types';
import type { Attachment } from './types';

export function buildAttachmentR2Key(attachmentId: string): string {
  return `attachments/${attachmentId}`;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function storeAttachmentInR2(
  bucket: R2Bucket,
  attachmentId: string,
  base64Content: string
): Promise<string> {
  const key = buildAttachmentR2Key(attachmentId);
  const bytes = base64ToBytes(base64Content);
  await bucket.put(key, bytes);
  return key;
}

export async function getAttachmentBytesFromR2(
  bucket: R2Bucket,
  r2Key: string
): Promise<Uint8Array | null> {
  const object = await bucket.get(r2Key);
  if (!object) return null;
  return new Uint8Array(await object.arrayBuffer());
}

/**
 * Resolve attachment binary from R2 (when r2_key set) or D1 base64/chunks fallback.
 */
export async function resolveAttachmentBytes(
  attachment: Attachment,
  bucket?: R2Bucket
): Promise<Uint8Array | null> {
  if (attachment.r2Key && bucket) {
    const fromR2 = await getAttachmentBytesFromR2(bucket, attachment.r2Key);
    if (fromR2) return fromR2;
  }

  if (!attachment.content) return null;
  return base64ToBytes(attachment.content);
}
