import { D1Database } from '@cloudflare/workers-types';
import { Env, SendAttachment } from './types';
import {
  assertEnabledMailDomain,
  resolveDefaultMailDomain,
} from './mail-domains';
import { extractEmailDomain, extractMailboxName } from './utils';
import { saveSentEmail } from './database';

export interface SendMailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** Pre-validated full sender address; defaults to no-reply@domain */
  from?: string;
  userId?: number | null;
  tokenId?: number | null;
  attachments?: SendAttachment[];
}

export interface SendMailResult {
  success: boolean;
  error?: string;
  sentEmailId?: number;
}

export const MAX_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024;

const SENDER_NAME = 'zMailR';

export function validateSendAttachments(
  attachments: unknown
): { ok: true; attachments: SendAttachment[] } | { ok: false; error: string } {
  if (attachments == null) return { ok: true, attachments: [] };
  if (!Array.isArray(attachments)) {
    return { ok: false, error: 'attachments 必须是数组' };
  }
  if (attachments.length === 0) return { ok: true, attachments: [] };

  let totalBytes = 0;
  const parsed: SendAttachment[] = [];

  for (const item of attachments) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'attachments 项格式无效' };
    }
    const name = String((item as { name?: unknown }).name ?? '').trim();
    const content = String((item as { content?: unknown }).content ?? '').trim();
    if (!name) return { ok: false, error: '附件名称不能为空' };
    if (!content) return { ok: false, error: `附件 ${name} 内容不能为空` };
    if (!/^[A-Za-z0-9+/=\s]+$/.test(content)) {
      return { ok: false, error: `附件 ${name} 须为 base64 编码` };
    }
    const normalized = content.replace(/\s/g, '');
    const pad = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
    const byteLength = Math.floor((normalized.length * 3) / 4) - pad;
    if (byteLength <= 0) {
      return { ok: false, error: `附件 ${name} 内容无效` };
    }
    totalBytes += byteLength;
    if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
      return { ok: false, error: `附件总大小不能超过 ${MAX_ATTACHMENT_TOTAL_BYTES / (1024 * 1024)}MB` };
    }
    parsed.push({ name, content: normalized });
  }

  return { ok: true, attachments: parsed };
}

function buildSaveParams(
  data: SendMailPayload,
  fromEmail: string,
  status: string,
  errorMessage?: string
) {
  return {
    toEmail: data.to,
    subject: data.subject,
    status,
    userId: data.userId,
    tokenId: data.tokenId,
    fromEmail,
    bodyText: data.text ?? null,
    bodyHtml: data.html ?? null,
    errorMessage: errorMessage ?? null,
    attachments: data.attachments ?? null,
  };
}

async function sendViaBrevo(
  apiKey: string,
  fromEmail: string,
  senderName: string,
  data: SendMailPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {
    sender: { name: senderName, email: fromEmail },
    to: [{ email: data.to }],
    subject: data.subject,
  };
  if (data.text) body.textContent = data.text;
  if (data.html) body.htmlContent = data.html;
  if (data.attachments && data.attachments.length > 0) {
    body.attachment = data.attachments.map(a => ({ name: a.name, content: a.content }));
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, error: `Brevo error: ${response.status} ${errorText}` };
  }
  return { ok: true };
}

/**
 * 通过 Brevo 发送邮件。
 * 发件域名取自 from 地址中的域名，并在已启用域名列表中校验。
 */
export async function sendMail(
  db: D1Database,
  env: Env,
  data: SendMailPayload
): Promise<SendMailResult> {
  const defaultDomain = await resolveDefaultMailDomain(db, env);
  const fromEmail = data.from ?? `no-reply@${defaultDomain}`;
  const sendDomain = extractEmailDomain(fromEmail);
  const domainCheck = await assertEnabledMailDomain(db, env, sendDomain);
  if (!domainCheck.ok) {
    const error = domainCheck.error;
    await saveSentEmail(db, buildSaveParams(data, fromEmail, 'failed', error));
    return { success: false, error };
  }

  const localPart = extractMailboxName(fromEmail);
  const senderName = data.from && localPart !== 'no-reply' ? localPart : SENDER_NAME;

  const brevoKey = env.BREVO_API_KEY;
  if (!brevoKey) {
    const error = '未配置 BREVO_API_KEY';
    console.error(error);
    await saveSentEmail(db, buildSaveParams(data, fromEmail, 'failed', error));
    return { success: false, error };
  }

  try {
    const result = await sendViaBrevo(brevoKey, fromEmail, senderName, data);

    if (!result.ok) {
      console.error('发信失败:', result.error);
      await saveSentEmail(db, buildSaveParams(data, fromEmail, 'failed', result.error));
      return { success: false, error: result.error };
    }

    const record = await saveSentEmail(db, buildSaveParams(data, fromEmail, 'sent'));
    return { success: true, sentEmailId: record.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('发送邮件异常:', error);
    await saveSentEmail(db, buildSaveParams(data, fromEmail, 'failed', message));
    return { success: false, error: message };
  }
}
