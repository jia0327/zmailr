import { D1Database } from '@cloudflare/workers-types';
import { Env } from './types';
import { verifyApiToken } from './database';

const ADMIN_SESSION_COOKIE = 'zmail_admin_session';
const SESSION_MAX_AGE = 86400; // 24h

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function authenticateApiToken(db: D1Database, request: Request): Promise<boolean> {
  const token = extractBearerToken(request);
  if (!token) return false;
  return verifyApiToken(db, token);
}

export function verifyAdminPassword(env: Env, password: string): boolean {
  if (!env.ADMIN_PASSWORD) return false;
  return password === env.ADMIN_PASSWORD;
}

async function signSession(secret: string): Promise<string> {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = String(exp);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
  return `${payload}.${sigHex}`;
}

async function verifySessionToken(secret: string, session: string): Promise<boolean> {
  const parts = session.split('.');
  if (parts.length !== 2) return false;
  const [expStr, sigHex] = parts;
  const exp = parseInt(expStr, 10);
  if (!exp || Date.now() > exp) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expStr));
  const expectedHex = Array.from(new Uint8Array(expected), b => b.toString(16).padStart(2, '0')).join('');
  return sigHex === expectedHex;
}

export async function createAdminSessionCookie(env: Env): Promise<string> {
  const token = await signSession(env.ADMIN_PASSWORD || '');
  return `${ADMIN_SESSION_COOKIE}=${token}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}

function getAdminSessionFromRequest(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function isAdminAuthenticated(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  const session = getAdminSessionFromRequest(request);
  if (!session) return false;
  return verifySessionToken(env.ADMIN_PASSWORD, session);
}

export function clearAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE}=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0`;
}
