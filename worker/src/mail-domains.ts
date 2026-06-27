import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from './types';
import {
  getEnabledMailDomainNames,
  seedMailDomainsFromEnvIfEmpty,
} from './database';
import { buildMailboxEmail, extractEmailDomain, extractMailboxName } from './utils';
function parseEnvDomainList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/** 从环境变量读取邮箱域名列表（兼容旧配置） */
export function getMailDomainsFromEnv(env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN'>): string[] {
  const domains = new Set<string>();
  for (const d of parseEnvDomainList(env.MAIL_DOMAIN)) domains.add(d);
  for (const d of parseEnvDomainList(env.VITE_EMAIL_DOMAIN)) domains.add(d);
  return [...domains];
}

/** 确保 D1 已从环境变量完成首次导入 */
export async function ensureMailDomainsSeeded(db: D1Database, env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN'>): Promise<void> {
  const raw = env.VITE_EMAIL_DOMAIN || env.MAIL_DOMAIN || '';
  await seedMailDomainsFromEnvIfEmpty(db, raw);
}

/** 已启用的邮箱域名：优先 D1，回退环境变量 */
export async function resolveEnabledMailDomainNames(
  db: D1Database,
  env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN'>
): Promise<string[]> {
  await ensureMailDomainsSeeded(db, env);
  const fromDb = await getEnabledMailDomainNames(db);
  if (fromDb.length) return fromDb;
  return getMailDomainsFromEnv(env);
}

/** 默认邮箱域名（发信/租用等未指定域名时的回退） */
export async function resolveDefaultMailDomain(
  db: D1Database,
  env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN'>
): Promise<string> {
  const enabled = await resolveEnabledMailDomainNames(db, env);
  return enabled[0] || 'example.com';
}

/** 校验域名在已启用列表中，返回规范化域名 */
export async function assertEnabledMailDomain(
  db: D1Database,
  env: Pick<Env, 'MAIL_DOMAIN' | 'VITE_EMAIL_DOMAIN'>,
  domain: string
): Promise<{ ok: true; domain: string } | { ok: false; error: string }> {
  const normalized = domain.trim().toLowerCase();
  const enabled = await resolveEnabledMailDomainNames(db, env);
  if (!enabled.includes(normalized)) {
    return { ok: false, error: '域名未启用或未在管理后台配置' };
  }
  return { ok: true, domain: normalized };
}

/** 为邮箱记录解析展示/发信用域名 */
export function resolveMailboxEmailDomain(
  mailbox: { address: string; mailDomain?: string | null },
  fallbackDomain: string
): string {
  if (mailbox.mailDomain) return mailbox.mailDomain.toLowerCase();
  if (mailbox.address.includes('@')) return extractEmailDomain(mailbox.address);
  return fallbackDomain.toLowerCase();
}

export function formatMailboxEmail(
  mailbox: { address: string; mailDomain?: string | null },
  fallbackDomain: string
): string {
  const localPart = mailbox.address.includes('@')
    ? extractMailboxName(mailbox.address)
    : mailbox.address;
  const domain = resolveMailboxEmailDomain(mailbox, fallbackDomain);
  return buildMailboxEmail(localPart, domain);
}
