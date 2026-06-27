import { D1Database } from '@cloudflare/workers-types';
import { Env } from './types';
import { hashPassword, hashToken } from './crypto';
import {
  createRegistrationVerification,
  createUser,
  deleteRegistrationVerification,
  getRegistrationVerificationByEmail,
  getRegistrationSettings,
  getUserByUsername,
  incrementRegistrationVerificationAttempts,
} from './database';
import { sendMail } from './sender';
import {
  isAllowedRegistrationEmail,
  normalizeRegistrationEmail,
  registrationEmailDomainHint,
} from './registration-domains';
import { getCurrentTimestamp } from './utils';

export const REGISTRATION_CODE_TTL_SEC = 15 * 60;
export const REGISTRATION_MAX_VERIFY_ATTEMPTS = 5;
export const REGISTRATION_MIN_PASSWORD_LENGTH = 8;

export function validateRegistrationPassword(password: string): string | null {
  if (!password || password.length < REGISTRATION_MIN_PASSWORD_LENGTH) {
    return `密码至少 ${REGISTRATION_MIN_PASSWORD_LENGTH} 位`;
  }
  return null;
}

export function generateRegistrationCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}

export async function hashRegistrationCode(code: string): Promise<string> {
  return hashToken(code.trim());
}

function buildVerificationEmailContent(code: string): { subject: string; text: string; html: string } {
  const subject = 'zMailR 注册验证码';
  const text = `您的 zMailR 注册验证码为：${code}\n\n验证码 ${REGISTRATION_CODE_TTL_SEC / 60} 分钟内有效，请勿泄露给他人。如非本人操作请忽略此邮件。`;
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#0f172a">
<p>您好，</p>
<p>您正在注册 zMailR 账户，验证码为：</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0284c7">${code}</p>
<p>验证码 <strong>${REGISTRATION_CODE_TTL_SEC / 60} 分钟</strong>内有效，请勿泄露给他人。</p>
<p style="color:#64748b;font-size:14px">如非本人操作，请忽略此邮件。</p>
</div>`;
  return { subject, text, html };
}

async function deleteRegistrationVerificationByEmailSafe(db: D1Database, email: string): Promise<void> {
  const row = await getRegistrationVerificationByEmail(db, email);
  if (row) await deleteRegistrationVerification(db, row.id);
}

export async function sendRegistrationVerificationCode(
  db: D1Database,
  env: Env,
  params: { email: string; password: string; ip: string | null }
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const settings = await getRegistrationSettings(db);
  if (!settings.enabled) {
    return { ok: false, error: '注册功能未开放', status: 403 };
  }

  const email = normalizeRegistrationEmail(params.email);
  if (!isAllowedRegistrationEmail(email)) {
    return {
      ok: false,
      error: `仅支持 ${registrationEmailDomainHint()} 等知名邮箱注册`,
      status: 400,
    };
  }

  const passwordError = validateRegistrationPassword(params.password);
  if (passwordError) {
    return { ok: false, error: passwordError, status: 400 };
  }

  const existing = await getUserByUsername(db, email);
  if (existing) {
    return { ok: false, error: '该邮箱已注册', status: 409 };
  }

  const code = generateRegistrationCode();
  const [passwordHash, codeHash] = await Promise.all([
    hashPassword(params.password),
    hashRegistrationCode(code),
  ]);
  const expiresAt = getCurrentTimestamp() + REGISTRATION_CODE_TTL_SEC;

  await createRegistrationVerification(db, {
    email,
    passwordHash,
    codeHash,
    expiresAt,
    ip: params.ip,
  });

  const { subject, text, html } = buildVerificationEmailContent(code);
  const sendResult = await sendMail(db, env, {
    to: email,
    subject,
    text,
    html,
    userId: null,
    tokenId: null,
  });

  if (!sendResult.success) {
    await deleteRegistrationVerificationByEmailSafe(db, email);
    return { ok: false, error: sendResult.error || '验证码发送失败，请稍后重试', status: 503 };
  }

  return { ok: true };
}

export async function verifyRegistrationCode(
  db: D1Database,
  params: { email: string; code: string }
): Promise<
  | { ok: true; userId: number; username: string }
  | { ok: false; error: string; status?: number; expired?: boolean }
> {
  const settings = await getRegistrationSettings(db);
  if (!settings.enabled) {
    return { ok: false, error: '注册功能未开放', status: 403 };
  }

  const email = normalizeRegistrationEmail(params.email);
  const code = String(params.code ?? '').trim();
  if (!code) {
    return { ok: false, error: '请输入验证码', status: 400 };
  }

  const pending = await getRegistrationVerificationByEmail(db, email);
  if (!pending) {
    return { ok: false, error: '验证码无效或已过期，请重新获取', status: 400 };
  }

  const now = getCurrentTimestamp();
  if (pending.expiresAt < now) {
    await deleteRegistrationVerification(db, pending.id);
    return { ok: false, error: '验证码已过期，请重新获取', status: 400, expired: true };
  }

  if (pending.attempts >= REGISTRATION_MAX_VERIFY_ATTEMPTS) {
    await deleteRegistrationVerification(db, pending.id);
    return { ok: false, error: '验证码错误次数过多，请重新获取', status: 429 };
  }

  const codeHash = await hashRegistrationCode(code);
  if (codeHash !== pending.codeHash) {
    await incrementRegistrationVerificationAttempts(db, pending.id);
    return { ok: false, error: '验证码错误', status: 400 };
  }

  const existing = await getUserByUsername(db, email);
  if (existing) {
    await deleteRegistrationVerification(db, pending.id);
    return { ok: false, error: '该邮箱已注册', status: 409 };
  }

  const user = await createUser(db, {
    username: email,
    password: '__pending__',
    role: 'user',
  });

  await db
    .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .bind(pending.passwordHash, user.id)
    .run();

  await deleteRegistrationVerification(db, pending.id);
  return { ok: true, userId: user.id, username: email };
}

export async function resendRegistrationVerificationCode(
  db: D1Database,
  env: Env,
  params: { email: string; ip: string | null }
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const settings = await getRegistrationSettings(db);
  if (!settings.enabled) {
    return { ok: false, error: '注册功能未开放', status: 403 };
  }

  const email = normalizeRegistrationEmail(params.email);
  const pending = await getRegistrationVerificationByEmail(db, email);
  if (!pending) {
    return { ok: false, error: '请先填写邮箱和密码获取验证码', status: 400 };
  }

  const now = getCurrentTimestamp();
  if (pending.expiresAt < now) {
    await deleteRegistrationVerification(db, pending.id);
    return { ok: false, error: '验证码已过期，请重新填写密码获取', status: 400 };
  }

  const existing = await getUserByUsername(db, email);
  if (existing) {
    await deleteRegistrationVerification(db, pending.id);
    return { ok: false, error: '该邮箱已注册', status: 409 };
  }

  const code = generateRegistrationCode();
  const codeHash = await hashRegistrationCode(code);
  const expiresAt = getCurrentTimestamp() + REGISTRATION_CODE_TTL_SEC;

  await db
    .prepare(
      `UPDATE registration_verifications SET code_hash = ?, expires_at = ?, attempts = 0, created_at = ?, ip = ? WHERE id = ?`
    )
    .bind(codeHash, expiresAt, getCurrentTimestamp(), params.ip, pending.id)
    .run();

  const { subject, text, html } = buildVerificationEmailContent(code);
  const sendResult = await sendMail(db, env, {
    to: email,
    subject,
    text,
    html,
    userId: null,
    tokenId: null,
  });

  if (!sendResult.success) {
    return { ok: false, error: sendResult.error || '验证码发送失败，请稍后重试', status: 503 };
  }

  return { ok: true };
}
