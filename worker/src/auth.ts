import { D1Database } from '@cloudflare/workers-types';
import { Env, ApiAuthContext, TokenScope, User, Mailbox } from './types';
import {
  verifyApiToken,
  verifyUserToken,
  getUserById,
  getUserByUsername,
  updateUserLastLogin,
  getMailbox,
  getMailboxRaw,
  getLatestLeasedMailbox,
  isMailboxOwnedByUser,
} from './database';
import { verifyPassword } from './crypto';
import { adminPathPrefix } from './admin-path';
import { validateSendFromAddress, extractEmailDomain, parseMailboxAddress, getCurrentTimestamp } from './utils';
import { resolveDefaultMailDomain, resolveMailboxEmailDomain } from './mail-domains';

const ADMIN_SESSION_COOKIE = 'zmail_admin_session';
const USER_SESSION_COOKIE = 'zmail_user_session';
const SESSION_MAX_AGE = 86400; // 24h

export const ALL_SCOPES: TokenScope[] = ['lease', 'mail', 'send'];

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function authenticateApiToken(
  db: D1Database,
  request: Request
): Promise<ApiAuthContext | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  const userAuth = await verifyUserToken(db, token);
  if (userAuth) {
    const user = await getUserById(db, userAuth.userId);
    if (!user || !user.enabled) return null;
    return {
      type: 'user',
      userId: userAuth.userId,
      tokenId: userAuth.tokenId,
      scopes: userAuth.scopes,
      dailySendQuota: user.dailySendQuota,
    };
  }

  const legacyOk = await verifyApiToken(db, token);
  if (legacyOk) {
    return { type: 'legacy', scopes: ALL_SCOPES };
  }

  return null;
}

export function hasScope(auth: ApiAuthContext, scope: TokenScope): boolean {
  return auth.scopes.includes(scope);
}

export interface AccessContext {
  user?: User | null;
  auth?: ApiAuthContext | null;
}

/** Returns true when the caller may read/write the given mailbox. */
export function assertMailboxAccess(mailbox: Mailbox, ctx: AccessContext): boolean {
  if (mailbox.userId != null) {
    if (ctx.user?.id === mailbox.userId) return true;
    if (ctx.auth?.type === 'user' && ctx.auth.userId === mailbox.userId) return true;
    return false;
  }
  // Legacy mailboxes without user_id: legacy Bearer token or admin session only
  if (ctx.auth?.type === 'legacy') return true;
  if (ctx.user?.role === 'admin') return true;
  return false;
}

export function verifyAdminPassword(env: Env, password: string): boolean {
  if (!env.ADMIN_PASSWORD) return false;
  return password === env.ADMIN_PASSWORD;
}

function getSessionSecret(env: Env): string {
  return env.ADMIN_PASSWORD || 'zmail-dev-secret';
}

async function signSession(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${payload}.${sigHex}`;
}

async function verifySessionToken(secret: string, session: string): Promise<string | null> {
  const lastDot = session.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const payload = session.slice(0, lastDot);
  const sigHex = session.slice(lastDot + 1);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expectedHex = Array.from(new Uint8Array(expected), (b) => b.toString(16).padStart(2, '0')).join('');
  if (sigHex !== expectedHex) return null;

  const parts = payload.split('.');
  const exp = parseInt(parts[parts.length - 1], 10);
  if (!exp || Date.now() > exp) return null;

  return payload;
}

export async function createAdminSessionCookie(env: Env): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const token = await signSession(getSessionSecret(env), String(exp));
  const path = adminPathPrefix(env);
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}

function getCookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function isAdminAuthenticated(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const session = getCookieValue(request, ADMIN_SESSION_COOKIE);
  if (!session) return false;
  const payload = await verifySessionToken(getSessionSecret(env), session);
  return payload !== null;
}

export function clearAdminSessionCookie(env: Env): string {
  const path = adminPathPrefix(env);
  return `${ADMIN_SESSION_COOKIE}=; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function createUserSessionCookie(env: Env, userId: number): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${exp}`;
  const token = await signSession(getSessionSecret(env), payload);
  return `${USER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearUserSessionCookie(): string {
  return `${USER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/** Session cookie or user Bearer token (any scope); legacy admin tokens are not accepted. */
export async function resolveUserFromSessionOrBearer(
  db: D1Database,
  request: Request,
  env: Env
): Promise<User | null> {
  const sessionUser = await getAuthenticatedUser(db, request, env);
  if (sessionUser) return sessionUser;

  const auth = await authenticateApiToken(db, request);
  if (auth?.type === 'user' && auth.userId != null) {
    const user = await getUserById(db, auth.userId);
    if (user?.enabled) return user;
  }
  return null;
}

export async function getAuthenticatedUser(
  db: D1Database,
  request: Request,
  env: Env
): Promise<User | null> {
  const session = getCookieValue(request, USER_SESSION_COOKIE);
  if (!session) return null;

  const payload = await verifySessionToken(getSessionSecret(env), session);
  if (!payload) return null;

  const userId = parseInt(payload.split('.')[0], 10);
  if (!userId) return null;

  const user = await getUserById(db, userId);
  if (!user || !user.enabled) return null;
  return user;
}

export type SendFromAuthMode = 'user' | 'legacy';

/**
 * Resolve and authorize a custom from address for outbound mail.
 * User mode: mailbox must belong to userId.
 * Legacy mode: only unowned mailboxes (user_id IS NULL).
 */
export async function resolveSendFromAddress(
  db: D1Database,
  from: string | undefined,
  allowedDomains: string | string[],
  mode: SendFromAuthMode,
  userId?: number | null
): Promise<{ ok: true; fromEmail?: string } | { ok: false; error: string }> {
  if (from == null || from === '') {
    return { ok: true };
  }

  const validated = validateSendFromAddress(String(from), allowedDomains);
  if (!validated.ok) {
    return validated;
  }

  const mailbox = await getMailbox(db, validated.localPart);
  if (!mailbox) {
    return { ok: false, error: 'from 邮箱不存在或已过期' };
  }

  if (mailbox.userId != null) {
    if (mode !== 'user' || userId == null || mailbox.userId !== userId) {
      return { ok: false, error: '无权使用该发件地址' };
    }
    const owned = await isMailboxOwnedByUser(db, validated.localPart, userId);
    if (!owned) {
      return { ok: false, error: '无权使用该发件地址' };
    }
  } else if (mode !== 'legacy') {
    return { ok: false, error: '无权使用该发件地址' };
  }

  if (mailbox.mailDomain) {
    const fromDomain = extractEmailDomain(validated.fromEmail);
    if (fromDomain !== mailbox.mailDomain.toLowerCase()) {
      return { ok: false, error: '发件域名须与邮箱绑定的域名一致' };
    }
  }

  return { ok: true, fromEmail: validated.fromEmail };
}

export function canSendFromMailbox(
  mailbox: Mailbox,
  mode: SendFromAuthMode,
  userId?: number | null
): { ok: true } | { ok: false; error: string } {
  if (mailbox.userId != null) {
    if (mode !== 'user' || userId == null || mailbox.userId !== userId) {
      return { ok: false, error: '无权使用该发件地址' };
    }
  } else if (mode !== 'legacy') {
    return { ok: false, error: '无权使用该发件地址' };
  }
  return { ok: true };
}

function isFromDomainAllowed(fromEmail: string, allowedDomains: string | string[]): boolean {
  const domain = extractEmailDomain(fromEmail);
  const allowed = (Array.isArray(allowedDomains) ? allowedDomains : [allowedDomains]).map((d) =>
    d.toLowerCase()
  );
  return allowed.includes(domain);
}

/**
 * Resolve outbound from: explicit from, else no-reply@leased domain, else no-reply@default.
 */
export async function resolveOutboundFrom(
  db: D1Database,
  env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN'>,
  params: {
    from?: string | null;
    mailboxHint?: string | null;
    allowedDomains: string | string[];
    mode: SendFromAuthMode;
    userId?: number | null;
    ipAddress?: string | null;
  }
): Promise<{ ok: true; fromEmail: string } | { ok: false; error: string }> {
  const defaultDomain = await resolveDefaultMailDomain(db, env);

  if (params.from != null && String(params.from).trim() !== '') {
    const result = await resolveSendFromAddress(
      db,
      String(params.from),
      params.allowedDomains,
      params.mode,
      params.userId
    );
    if (!result.ok) return result;
    return { ok: true, fromEmail: result.fromEmail ?? `no-reply@${defaultDomain}` };
  }

  let mailbox: Mailbox | null = null;
  const hint = params.mailboxHint?.trim();
  if (hint) {
    const localPart = parseMailboxAddress(hint);
    const found = await getMailboxRaw(db, localPart);
    if (found && found.expiresAt > getCurrentTimestamp()) {
      mailbox = found;
    }
  } else {
    mailbox = await getLatestLeasedMailbox(db, {
      userId: params.mode === 'user' ? params.userId : undefined,
      ipAddress: params.mode === 'legacy' ? params.ipAddress : undefined,
      legacyOnly: params.mode === 'legacy',
    });
  }

  if (mailbox) {
    const access = canSendFromMailbox(mailbox, params.mode, params.userId);
    if (!access.ok) return access;
    if (params.mode === 'user' && params.userId != null) {
      const owned = await isMailboxOwnedByUser(db, mailbox.address, params.userId);
      if (!owned) {
        return { ok: false, error: '无权使用该发件地址' };
      }
    }
    const sendDomain = resolveMailboxEmailDomain(mailbox, defaultDomain);
    const fromEmail = `no-reply@${sendDomain}`;
    if (!isFromDomainAllowed(fromEmail, params.allowedDomains)) {
      return { ok: false, error: 'from 域名与系统允许的域名不匹配' };
    }
    return { ok: true, fromEmail };
  }

  return { ok: true, fromEmail: `no-reply@${defaultDomain}` };
}

export async function authenticateUserLogin(
  db: D1Database,
  username: string,
  password: string
): Promise<User | null> {
  const user = await getUserByUsername(db, username);
  if (!user || !user.enabled) return null;

  const row = await db.prepare(`SELECT password_hash FROM users WHERE id = ?`).bind(user.id).first<{ password_hash: string }>();
  if (!row) return null;

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return null;

  await updateUserLastLogin(db, user.id);
  return user;
}
