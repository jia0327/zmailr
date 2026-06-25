import { D1Database } from '@cloudflare/workers-types';
import { Env } from './types';
import { getMailDomain } from './utils';
import { saveSentEmail } from './database';

export interface SendMailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface SendMailResult {
  success: boolean;
  error?: string;
  sentEmailId?: number;
}

/**
 * 通过 MailChannels 发送邮件
 */
export async function sendMail(
  db: D1Database,
  env: Env,
  data: SendMailPayload
): Promise<SendMailResult> {
  const domain = getMailDomain(env);
  const fromEmail = `no-reply@${domain}`;

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

  const apiKey = env.MAILCHANNELS_API_KEY;
  if (!apiKey) {
    const error = 'MAILCHANNELS_API_KEY is not configured';
    console.error(error);
    await saveSentEmail(db, data.to, data.subject, 'failed');
    return { success: false, error };
  }

  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-MailChannels-Custom-Sender-Domain': domain,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: data.to }] }],
        from: { email: fromEmail, name: 'System' },
        subject: data.subject,
        content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MailChannels 发送失败:', response.status, errorText);
      await saveSentEmail(db, data.to, data.subject, 'failed');
      return { success: false, error: `MailChannels error: ${response.status} ${errorText}` };
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
