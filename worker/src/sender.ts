import { D1Database } from '@cloudflare/workers-types';
import { Env } from './types';
import { getMailDomain } from './utils';
import { saveSentEmail } from './database';

export interface SendMailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** Pre-validated full sender address; defaults to no-reply@domain */
  from?: string;
}

export interface SendMailResult {
  success: boolean;
  error?: string;
  sentEmailId?: number;
}

const SENDER_NAME = 'zMailR';

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

async function sendViaMailChannels(
  apiKey: string,
  domain: string,
  fromEmail: string,
  senderName: string,
  data: SendMailPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const content: Array<{ type: string; value: string }> = [];
  if (data.text) {
    content.push({ type: 'text/plain', value: data.text });
  }
  if (data.html) {
    content.push({ type: 'text/html', value: data.html });
  }
  if (content.length === 0) {
    content.push({ type: 'text/plain', value: '' });
  }

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-MailChannels-Custom-Sender-Domain': domain,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: data.to }] }],
      from: { email: fromEmail, name: senderName },
      subject: data.subject,
      content,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, error: `MailChannels error: ${response.status} ${errorText}` };
  }
  return { ok: true };
}

/**
 * 发送邮件：优先 Brevo，未配置时回退 MailChannels
 */
export async function sendMail(
  db: D1Database,
  env: Env,
  data: SendMailPayload
): Promise<SendMailResult> {
  const domain = getMailDomain(env);
  const fromEmail = data.from ?? `no-reply@${domain}`;
  const senderName = data.from ? fromEmail.split('@')[0] : SENDER_NAME;

  const brevoKey = env.BREVO_API_KEY;
  const mailchannelsKey = env.MAILCHANNELS_API_KEY;

  if (!brevoKey && !mailchannelsKey) {
    const error = 'BREVO_API_KEY or MAILCHANNELS_API_KEY must be configured';
    console.error(error);
    await saveSentEmail(db, data.to, data.subject, 'failed');
    return { success: false, error };
  }

  try {
    const result = brevoKey
      ? await sendViaBrevo(brevoKey, fromEmail, senderName, data)
      : await sendViaMailChannels(mailchannelsKey!, domain, fromEmail, senderName, data);

    if (!result.ok) {
      console.error('发信失败:', result.error);
      await saveSentEmail(db, data.to, data.subject, 'failed');
      return { success: false, error: result.error };
    }

    const record = await saveSentEmail(db, data.to, data.subject, 'sent');
    return { success: true, sentEmailId: record.id };
  } catch (error) {
    console.error('发送邮件异常:', error);
    await saveSentEmail(db, data.to, data.subject, 'failed');
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
