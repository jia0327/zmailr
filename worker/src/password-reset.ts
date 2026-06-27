import { D1Database } from '@cloudflare/workers-types';
import { Env } from './types';
import { hashPassword } from './crypto';
import {
  createPasswordResetVerification,
  deletePasswordResetVerification,
  getPasswordResetVerificationByEmail,
  getUserByUsername,
  incrementPasswordResetVerificationAttempts,
} from './database';
import { sendMail } from './sender';
import { normalizeRegistrationEmail } from './registration-domains';
import { getCurrentTimestamp } from './utils';
import {
  REGISTRATION_CODE_TTL_SEC,
  REGISTRATION_DELIVERY_HINT,
  REGISTRATION_MAX_VERIFY_ATTEMPTS,
  generateRegistrationCode,
  hashRegistrationCode,
  validateRegistrationPassword,
} from './registration';

export const PASSWORD_RESET_CODE_TTL_SEC = REGISTRATION_CODE_TTL_SEC;

function buildPasswordResetEmailContent(code: string): { subject: string; text: string; html: string } {
  const subject = `zMailR 重置密码验证码 ${code}`;
  const text = [
    '您正在重置 zMailR 账户密码。',
    '',
    `验证码：${code}`,
    '',
    `验证码 ${PASSWORD_RESET_CODE_TTL_SEC / 60} 分钟内有效，请勿泄露给他人。`,
    '如非本人操作，请忽略本邮件并确保账户安全。',
    '',
    '—— zMailR',
  ].join('\n');
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#0f172a;background:#f8fafc">
<div style="max-width:480px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<p style="margin:0 0 12px">您好，</p>
<p style="margin:0 0 16px">您正在重置 zMailR 账户密码，验证码为：</p>
<p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:8px;color:#0284c7">${code}</p>
<p style="margin:0 0 8px">验证码 <strong>${PASSWORD_RESET_CODE_TTL_SEC / 60} 分钟</strong>内有效，请勿泄露。</p>
<p style="margin:0;color:#64748b;font-size:14px">如非本人操作，请忽略本邮件。</p>
</div></body></html>`;
  return { subject, text, html };
}

function validateResetEmail(email: string): string | null {
  const normalized = normalizeRegistrationEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) {
    return '邮箱格式无效';
  }
  return null;
}

export async function sendPasswordResetVerificationCode(
  db: D1Database,
  env: Env,
  params: { email: string; password: string; ip: string | null }
): Promise<
  | { ok: true; deliveryHint: string; brevoMessageId?: string }
  | { ok: false; error: string; status?: number }
> {
  const emailError = validateResetEmail(params.email);
  if (emailError) {
    return { ok: false, error: emailError, status: 400 };
  }

  const email = normalizeRegistrationEmail(params.email);
  const passwordError = validateRegistrationPassword(params.password);
  if (passwordError) {
    return { ok: false, error: passwordError, status: 400 };
  }

  const user = await getUserByUsername(db, email);
  if (!user) {
    return { ok: false, error: '该邮箱未注册', status: 404 };
  }

  const code = generateRegistrationCode();
  const [passwordHash, codeHash] = await Promise.all([
    hashPassword(params.password),
    hashRegistrationCode(code),
  ]);
  const expiresAt = getCurrentTimestamp() + PASSWORD_RESET_CODE_TTL_SEC;

  const { subject, text, html } = buildPasswordResetEmailContent(code);
  const sendResult = await sendMail(db, env, {
    to: email,
    subject,
    text,
    html,
    userId: user.id,
    tokenId: null,
    tags: ['password-reset', 'verification'],
  });

  if (!sendResult.success) {
    const error = sendResult.error || '验证码发送失败，请稍后重试';
    if (error.includes('BREVO_API_KEY') || error.includes('Brevo error')) {
      return {
        ok: false,
        error: '系统发信未配置或发件域名未认证，请联系管理员检查 Brevo 配置',
        status: 503,
      };
    }
    return { ok: false, error, status: 503 };
  }

  await createPasswordResetVerification(db, {
    email,
    passwordHash,
    codeHash,
    expiresAt,
    ip: params.ip,
  });

  return { ok: true, deliveryHint: REGISTRATION_DELIVERY_HINT, brevoMessageId: sendResult.brevoMessageId };
}

export async function verifyPasswordResetCode(
  db: D1Database,
  params: { email: string; code: string }
): Promise<
  | { ok: true; userId: number; username: string }
  | { ok: false; error: string; status?: number; expired?: boolean }
> {
  const emailError = validateResetEmail(params.email);
  if (emailError) {
    return { ok: false, error: emailError, status: 400 };
  }

  const email = normalizeRegistrationEmail(params.email);
  const code = String(params.code ?? '').trim();
  if (!code) {
    return { ok: false, error: '请输入验证码', status: 400 };
  }

  const pending = await getPasswordResetVerificationByEmail(db, email);
  if (!pending) {
    return { ok: false, error: '验证码无效或已过期，请重新获取', status: 400 };
  }

  const now = getCurrentTimestamp();
  if (pending.expiresAt < now) {
    await deletePasswordResetVerification(db, pending.id);
    return { ok: false, error: '验证码已过期，请重新获取', status: 400, expired: true };
  }

  if (pending.attempts >= REGISTRATION_MAX_VERIFY_ATTEMPTS) {
    await deletePasswordResetVerification(db, pending.id);
    return { ok: false, error: '验证码错误次数过多，请重新获取', status: 429 };
  }

  const codeHash = await hashRegistrationCode(code);
  if (codeHash !== pending.codeHash) {
    await incrementPasswordResetVerificationAttempts(db, pending.id);
    return { ok: false, error: '验证码错误', status: 400 };
  }

  const user = await getUserByUsername(db, email);
  if (!user) {
    await deletePasswordResetVerification(db, pending.id);
    return { ok: false, error: '该邮箱未注册', status: 404 };
  }

  await db
    .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .bind(pending.passwordHash, user.id)
    .run();

  await deletePasswordResetVerification(db, pending.id);
  return { ok: true, userId: user.id, username: email };
}

export async function resendPasswordResetVerificationCode(
  db: D1Database,
  env: Env,
  params: { email: string; ip: string | null }
): Promise<
  | { ok: true; deliveryHint: string; brevoMessageId?: string }
  | { ok: false; error: string; status?: number }
> {
  const emailError = validateResetEmail(params.email);
  if (emailError) {
    return { ok: false, error: emailError, status: 400 };
  }

  const email = normalizeRegistrationEmail(params.email);
  const pending = await getPasswordResetVerificationByEmail(db, email);
  if (!pending) {
    return { ok: false, error: '请先填写邮箱和新密码获取验证码', status: 400 };
  }

  const now = getCurrentTimestamp();
  if (pending.expiresAt < now) {
    await deletePasswordResetVerification(db, pending.id);
    return { ok: false, error: '验证码已过期，请重新填写密码获取', status: 400 };
  }

  const user = await getUserByUsername(db, email);
  if (!user) {
    await deletePasswordResetVerification(db, pending.id);
    return { ok: false, error: '该邮箱未注册', status: 404 };
  }

  const code = generateRegistrationCode();
  const codeHash = await hashRegistrationCode(code);
  const expiresAt = getCurrentTimestamp() + PASSWORD_RESET_CODE_TTL_SEC;

  const { subject, text, html } = buildPasswordResetEmailContent(code);
  const sendResult = await sendMail(db, env, {
    to: email,
    subject,
    text,
    html,
    userId: user.id,
    tokenId: null,
    tags: ['password-reset', 'verification', 'resend'],
  });

  if (!sendResult.success) {
    const error = sendResult.error || '验证码发送失败，请稍后重试';
    if (error.includes('BREVO_API_KEY') || error.includes('Brevo error')) {
      return {
        ok: false,
        error: '系统发信未配置或发件域名未认证，请联系管理员检查 Brevo 配置',
        status: 503,
      };
    }
    return { ok: false, error, status: 503 };
  }

  await db
    .prepare(
      `UPDATE password_reset_verifications SET code_hash = ?, expires_at = ?, attempts = 0, created_at = ?, ip = ? WHERE id = ?`
    )
    .bind(codeHash, expiresAt, getCurrentTimestamp(), params.ip, pending.id)
    .run();

  return { ok: true, deliveryHint: REGISTRATION_DELIVERY_HINT, brevoMessageId: sendResult.brevoMessageId };
}
