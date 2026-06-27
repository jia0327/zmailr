import { D1Database } from '@cloudflare/workers-types';
import { 
  Mailbox, 
  CreateMailboxParams, 
  Email, 
  SaveEmailParams, 
  EmailListItem,
  Attachment,
  AttachmentListItem,
  SaveAttachmentParams,
  ApiToken,
  CreateApiTokenParams,
  ExtractRule,
  UserExtractRule,
  SaveExtractRuleParams,
  SentEmail,
  SendAttachment,
  AdminStats,
  User,
  UserToken,
  UserTokenCreated,
  DailyUsage,
  CreateUserParams,
  UpdateUserParams,
  CreateUserTokenParams,
  TokenScope,
  Announcement,
  SaveAnnouncementParams,
  AuditLog,
  WriteAuditLogParams,
  MaintenanceMode,
  DEFAULT_MAINTENANCE_MODE,
  RegistrationSettings,
  DEFAULT_REGISTRATION_SETTINGS,
  RegistrationSettingsAdminView,
  TurnstileSettings,
  DEFAULT_TURNSTILE_SETTINGS,
  TurnstileSettingsAdminView,
  RegistrationVerificationRow,
  DEFAULT_LEGACY_SEND_DAILY_QUOTA,
  RateLimitStats,
  ApiRequestStats,
  LocalEmailStats,
  MailDomain,
  CreateMailDomainParams,
  UpdateMailDomainParams,
} from './types';
import {
  aggregateByStatusCode,
  aggregateTopPaths,
  buildRequestStatsTrend,
  categorizeStatusTotals,
  lastStatDates,
  normalizeApiPath,
  REQUEST_STATS_TREND_DAYS,
  statDateFromTimestamp,
} from './api-request-stats';
import { 
  generateId, 
  getCurrentTimestamp, 
  calculateExpiryTimestamp,
  generateApiToken,
  shouldTouchTokenLastUsed,
} from './utils';
import { hashPassword, hashToken } from './crypto';
import { SEED_GLOBAL_EXTRACT_RULES } from './extractor';
import { storeAttachmentInR2 } from './r2-attachments';
import type { SaveAttachmentOptions } from './types';

// 附件分块大小（字节）
const CHUNK_SIZE = 500000; // 约500KB

const DB_INIT_KEY = '__zmailDbInitialized';

function isDatabaseInitializedInIsolate(): boolean {
  return (globalThis as Record<string, unknown>)[DB_INIT_KEY] === true;
}

function markDatabaseInitializedInIsolate(): void {
  (globalThis as Record<string, unknown>)[DB_INIT_KEY] = true;
}

/**
 * 每个 Worker isolate 仅执行一次完整迁移；同 isolate 内后续请求跳过 30+ D1 操作。
 * 新部署后冷启动 isolate 仍会跑完整 init。
 */
export async function ensureDatabaseInitialized(
  db: D1Database,
  adminPassword?: string
): Promise<void> {
  if (isDatabaseInitializedInIsolate()) {
    return;
  }
  await initializeDatabase(db, adminPassword);
  markDatabaseInitializedInIsolate();
}

/**
 * 初始化数据库
 * @param db 数据库实例
 * @param adminPassword 首次迁移时用于创建 admin 用户
 */
export async function initializeDatabase(db: D1Database, adminPassword?: string): Promise<void> {
  try {
    // Phase 1: create tables
    await db.exec(`CREATE TABLE IF NOT EXISTS mailboxes (id TEXT PRIMARY KEY, address TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ip_address TEXT, last_accessed INTEGER NOT NULL);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, mailbox_id TEXT NOT NULL, from_address TEXT NOT NULL, from_name TEXT, to_address TEXT NOT NULL, subject TEXT, text_content TEXT, html_content TEXT, received_at INTEGER NOT NULL, has_attachments BOOLEAN DEFAULT FALSE, is_read BOOLEAN DEFAULT FALSE, FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, email_id TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, content TEXT, size INTEGER NOT NULL, created_at INTEGER NOT NULL, is_large BOOLEAN DEFAULT FALSE, chunks_count INTEGER DEFAULT 0, FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS attachment_chunks (id TEXT PRIMARY KEY, attachment_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS api_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, name TEXT, expires_at INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch()));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS extract_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL DEFAULT '*', regex TEXT NOT NULL, priority INTEGER DEFAULT 0, enabled INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS sent_emails (id INTEGER PRIMARY KEY AUTOINCREMENT, to_email TEXT NOT NULL, subject TEXT NOT NULL, status TEXT DEFAULT 'sent', created_at INTEGER DEFAULT (unixepoch()));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', daily_send_quota INTEGER NOT NULL DEFAULT 50, rate_limit_per_min INTEGER DEFAULT 60, rate_limit_burst INTEGER, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()), last_login_at INTEGER);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS user_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT UNIQUE NOT NULL, name TEXT, scopes TEXT NOT NULL DEFAULT '["lease","mail","send"]', expires_at INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch()), last_used_at INTEGER, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS daily_usage (user_id INTEGER NOT NULL, usage_date TEXT NOT NULL, send_count INTEGER NOT NULL DEFAULT 0, lease_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, usage_date), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS api_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER, enabled INTEGER DEFAULT 1, created_by TEXT);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS announcement_reads (user_id INTEGER NOT NULL, announcement_id INTEGER NOT NULL, read_at INTEGER NOT NULL, PRIMARY KEY (user_id, announcement_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS rate_limit_hits (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, user_id INTEGER, path TEXT NOT NULL, hit_at INTEGER NOT NULL);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS api_request_stats (stat_date TEXT NOT NULL, status_code INTEGER NOT NULL, path_group TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (stat_date, status_code, path_group));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_type TEXT NOT NULL, actor_id TEXT, actor_name TEXT, action TEXT NOT NULL, detail TEXT, ip TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()));`);
    await db.exec(`CREATE TABLE IF NOT EXISTS mail_domains (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT UNIQUE NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, is_default INTEGER NOT NULL DEFAULT 0, cloudflare_ready INTEGER NOT NULL DEFAULT 0, brevo_verified INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS registration_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, password_hash TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, ip TEXT, attempts INTEGER NOT NULL DEFAULT 0);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS password_reset_verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, password_hash TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, ip TEXT, attempts INTEGER NOT NULL DEFAULT 0);`);

    // Phase 2: add columns to existing tables (must run before indexes on those columns)
    await migrateAddColumn(db, 'emails', 'extracted_code', 'TEXT');
    await migrateAddColumn(db, 'emails', 'raw_content', 'TEXT');
    await migrateAddColumn(db, 'emails', 'matched_rule_id', 'INTEGER');
    await migrateAddColumn(db, 'mailboxes', 'last_api_mail_email_id', 'TEXT');
    await migrateAddColumn(db, 'mailboxes', 'last_api_mail_received_at', 'INTEGER');
    await migrateAddColumn(db, 'mailboxes', 'user_id', 'INTEGER');
    await migrateAddColumn(db, 'mailboxes', 'mail_domain', 'TEXT');
    await migrateAddColumn(db, 'sent_emails', 'user_id', 'INTEGER');
    await migrateAddColumn(db, 'sent_emails', 'token_id', 'INTEGER');
    await migrateAddColumn(db, 'sent_emails', 'from_email', 'TEXT');
    await migrateAddColumn(db, 'sent_emails', 'body_text', 'TEXT');
    await migrateAddColumn(db, 'sent_emails', 'body_html', 'TEXT');
    await migrateAddColumn(db, 'sent_emails', 'error_message', 'TEXT');
    await migrateAddColumn(db, 'sent_emails', 'attachment_count', 'INTEGER DEFAULT 0');
    await migrateAddColumn(db, 'sent_emails', 'attachments_json', 'TEXT');
    await migrateAddColumn(db, 'extract_rules', 'user_id', 'INTEGER');
    await migrateAddColumn(db, 'extract_rules', 'remark', 'TEXT');
    await migrateAddColumn(db, 'users', 'rate_limit_per_min', 'INTEGER DEFAULT 60');
    await migrateAddColumn(db, 'users', 'rate_limit_burst', 'INTEGER');
    await migrateAddColumn(db, 'attachments', 'r2_key', 'TEXT');

    // Phase 3: create indexes (after all columns exist)
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_expires_at ON mailboxes(expires_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_user_id ON mailboxes(user_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_extracted_code ON emails(extracted_code);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_attachment_id ON attachment_chunks(attachment_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_chunk_index ON attachment_chunks(chunk_index);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_extract_rules_domain ON extract_rules(domain);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_extract_rules_user_id ON extract_rules(user_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_sent_emails_created_at ON sent_emails(created_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_user_tokens_hash ON user_tokens(token_hash);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_announcements_enabled ON announcements(enabled);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_request_stats_date ON api_request_stats(stat_date);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_hit_at ON rate_limit_hits(hit_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_ip ON rate_limit_hits(ip);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_rate_limit_hits_user_id ON rate_limit_hits(user_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mail_domains_enabled ON mail_domains(enabled);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mail_domains_sort ON mail_domains(sort_order);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registration_verifications_email ON registration_verifications(email);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_registration_verifications_expires ON registration_verifications(expires_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_password_reset_verifications_email ON password_reset_verifications(email);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_password_reset_verifications_expires ON password_reset_verifications(expires_at);`);

    await seedAdminUser(db, adminPassword);
    await seedGuestUser(db);
    await seedGlobalExtractRules(db);

    console.log('数据库初始化成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    // 抛出错误，让上层处理
    throw new Error(`数据库初始化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 安全地为已有表添加列（列已存在时忽略）
 */
async function migrateAddColumn(db: D1Database, table: string, column: string, definition: string): Promise<void> {
  try {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch {
    // 列已存在，忽略
  }
}

async function seedAdminUser(db: D1Database, adminPassword?: string): Promise<void> {
  if (!adminPassword) return;
  const count = await db.prepare(`SELECT COUNT(*) as c FROM users`).first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const passwordHash = await hashPassword(adminPassword);
  await db.prepare(
    `INSERT INTO users (username, password_hash, role, daily_send_quota, enabled) VALUES (?, ?, 'admin', -1, 1)`
  ).bind('admin', passwordHash).run();
  console.log('已创建初始 admin 用户');
}

/** 首次部署时创建 guest/guest 演示账号；已存在则跳过（不覆盖密码）。 */
async function seedGuestUser(db: D1Database): Promise<void> {
  const existing = await db.prepare(`SELECT id FROM users WHERE username = ?`).bind('guest').first();
  if (existing) return;
  const passwordHash = await hashPassword('guest');
  await db.prepare(
    `INSERT INTO users (username, password_hash, role, daily_send_quota, rate_limit_per_min, enabled)
     VALUES (?, ?, 'user', 50, 60, 1)`
  ).bind('guest', passwordHash).run();
  console.log('已创建演示 guest 用户 (guest/guest)');
}

const SEED_RULE_REMARK_PREFIX = '[seed:';

async function seedGlobalExtractRules(db: D1Database): Promise<void> {
  for (const rule of SEED_GLOBAL_EXTRACT_RULES) {
    const remark = `${SEED_RULE_REMARK_PREFIX}${rule.seedKey}] ${rule.remark}`;
    const existing = await db.prepare(
      `SELECT id FROM extract_rules
       WHERE user_id IS NULL AND domain = ? AND regex = ?`
    ).bind(rule.domain, rule.regex).first();
    if (existing) continue;

    await db.prepare(
      `INSERT INTO extract_rules (domain, regex, priority, enabled, user_id, remark)
       VALUES (?, ?, ?, 1, NULL, ?)`
    ).bind(rule.domain, rule.regex, rule.priority, remark).run();
  }
}

export function getTodayUsageDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapUser(row: Record<string, unknown>): User {
  const burstRaw = row.rate_limit_burst as number | null | undefined;
  return {
    id: row.id as number,
    username: row.username as string,
    role: row.role as User['role'],
    dailySendQuota: row.daily_send_quota as number,
    rateLimitPerMin: (row.rate_limit_per_min as number | null | undefined) ?? null,
    rateLimitBurst: burstRaw != null && burstRaw > 0 ? burstRaw : null,
    enabled: !!row.enabled,
    createdAt: row.created_at as number,
    lastLoginAt: (row.last_login_at as number | null) ?? null,
  };
}

function parseScopes(raw: string): TokenScope[] {
  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((s): s is TokenScope => s === 'lease' || s === 'mail' || s === 'send');
  } catch {
    return ['lease', 'mail', 'send'];
  }
}

const MAILBOX_COLUMNS =
  'id, address, created_at, expires_at, ip_address, last_accessed, user_id, mail_domain';

/**
 * 创建邮箱
 * @param db 数据库实例
 * @param params 参数
 * @returns 创建的邮箱
 */
export async function createMailbox(db: D1Database, params: CreateMailboxParams): Promise<Mailbox> {
  const now = getCurrentTimestamp();
  const mailbox: Mailbox = {
    id: generateId(),
    address: params.address,
    createdAt: now,
    expiresAt: calculateExpiryTimestamp(params.expiresInHours),
    ipAddress: params.ipAddress,
    lastAccessed: now,
    mailDomain: params.mailDomain ?? null,
  };
  
  await db.prepare(`INSERT INTO mailboxes (id, address, created_at, expires_at, ip_address, last_accessed, user_id, mail_domain) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(mailbox.id, mailbox.address, mailbox.createdAt, mailbox.expiresAt, mailbox.ipAddress, mailbox.lastAccessed, params.userId ?? null, mailbox.mailDomain ?? null).run();
  
  return mailbox;
}

/**
 * 获取邮箱信息
 * @param db 数据库实例
 * @param address 邮箱地址
 * @returns 邮箱信息
 */
function rowToMailbox(result: Record<string, unknown>, lastAccessed?: number): Mailbox {
  return {
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: lastAccessed ?? (result.last_accessed as number),
    userId: (result.user_id as number | null) ?? null,
    mailDomain: (result.mail_domain as string | null) ?? null,
  };
}

export async function getMailbox(db: D1Database, address: string): Promise<Mailbox | null> {
  const now = getCurrentTimestamp();
  const result = await db.prepare(`SELECT ${MAILBOX_COLUMNS} FROM mailboxes WHERE address = ? AND expires_at > ?`).bind(address, now).first();
  
  if (!result) return null;
  
  // 更新最后访问时间
  await db.prepare(`UPDATE mailboxes SET last_accessed = ? WHERE id = ?`).bind(now, result.id).run();
  
  return rowToMailbox(result as Record<string, unknown>, now);
}

export async function getMailboxRaw(db: D1Database, address: string): Promise<Mailbox | null> {
  const result = await db
    .prepare(
      `SELECT ${MAILBOX_COLUMNS} FROM mailboxes WHERE address = ?`
    )
    .bind(address)
    .first();
  if (!result) return null;
  return rowToMailbox(result as Record<string, unknown>);
}

/** 最近租用的未过期邮箱（用户按 created_at，Legacy 按同 IP + 无 user_id） */
export async function getLatestLeasedMailbox(
  db: D1Database,
  opts: { userId?: number | null; ipAddress?: string | null; legacyOnly?: boolean }
): Promise<Mailbox | null> {
  const now = getCurrentTimestamp();
  if (opts.legacyOnly) {
    if (!opts.ipAddress?.trim()) return null;
    const row = await db
      .prepare(
        `SELECT ${MAILBOX_COLUMNS} FROM mailboxes
         WHERE user_id IS NULL AND ip_address = ? AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(opts.ipAddress.trim(), now)
      .first();
    return row ? rowToMailbox(row as Record<string, unknown>) : null;
  }
  if (opts.userId == null) return null;
  const row = await db
    .prepare(
      `SELECT ${MAILBOX_COLUMNS} FROM mailboxes
       WHERE user_id = ? AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(opts.userId, now)
    .first();
  return row ? rowToMailbox(row as Record<string, unknown>) : null;
}

export async function getMailboxById(db: D1Database, id: string): Promise<Mailbox | null> {
  const now = getCurrentTimestamp();
  const result = await db
    .prepare(
      `SELECT ${MAILBOX_COLUMNS} FROM mailboxes WHERE id = ? AND expires_at > ?`
    )
    .bind(id, now)
    .first();

  if (!result) return null;
  return rowToMailbox(result as Record<string, unknown>);
}

export async function getMailboxRawById(db: D1Database, id: string): Promise<Mailbox | null> {
  const result = await db
    .prepare(
      `SELECT ${MAILBOX_COLUMNS} FROM mailboxes WHERE id = ?`
    )
    .bind(id)
    .first();
  if (!result) return null;
  return rowToMailbox(result as Record<string, unknown>);
}

/**
 * 获取用户的所有邮箱
 * @param db 数据库实例
 * @param ipAddress IP地址
 * @returns 邮箱列表
 */
export async function getMailboxes(db: D1Database, ipAddress: string): Promise<Mailbox[]> {
  const now = getCurrentTimestamp();
  const results = await db.prepare(`SELECT id, address, created_at, expires_at, ip_address, last_accessed FROM mailboxes WHERE ip_address = ? AND expires_at > ? ORDER BY created_at DESC`).bind(ipAddress, now).all();
  
  if (!results.results) return [];
  
  return results.results.map(result => ({
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: result.last_accessed as number,
  }));
}

function mapMailboxRow(result: Record<string, unknown>): Mailbox {
  return {
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: result.last_accessed as number,
    userId: (result.user_id as number | null) ?? null,
    mailDomain: (result.mail_domain as string | null) ?? null,
  };
}

export interface ListMailboxesByUserOptions {
  limit?: number;
  offset?: number;
  includeExpired?: boolean;
  hasEmails?: boolean;
  search?: string;
}

export interface PaginatedMailboxes {
  mailboxes: Mailbox[];
  total: number;
}

export async function listMailboxesByUser(
  db: D1Database,
  userId: number,
  options: ListMailboxesByUserOptions = {}
): Promise<PaginatedMailboxes> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const includeExpired = options.includeExpired ?? false;
  const hasEmails = options.hasEmails ?? false;
  const searchTerm = (options.search ?? '').trim();

  const now = getCurrentTimestamp();
  const whereClauses = ['m.user_id = ?'];
  const bindings: unknown[] = [userId];

  if (!includeExpired) {
    whereClauses.push('m.expires_at > ?');
    bindings.push(now);
  }

  if (hasEmails) {
    whereClauses.push('EXISTS (SELECT 1 FROM emails e WHERE e.mailbox_id = m.id)');
  }

  if (searchTerm) {
    const localPart = (searchTerm.includes('@') ? searchTerm.split('@')[0] : searchTerm)
      .replace(/[%_]/g, '');
    if (localPart) {
      whereClauses.push('m.address LIKE ?');
      bindings.push(`%${localPart}%`);
    }
  }

  const where = whereClauses.join(' AND ');
  const fromClause = 'FROM mailboxes m';

  const countRow = await db
    .prepare(`SELECT COUNT(*) as count ${fromClause} WHERE ${where}`)
    .bind(...bindings)
    .first<{ count: number }>();

  const results = await db
    .prepare(
      `SELECT m.id, m.address, m.created_at, m.expires_at, m.ip_address, m.last_accessed, m.user_id, m.mail_domain
       ${fromClause}
       WHERE ${where}
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...bindings, limit, offset)
    .all();

  const mailboxes = results.results
    ? results.results.map((row) => rowToMailbox(row as Record<string, unknown>))
    : [];

  return { mailboxes, total: countRow?.count ?? 0 };
}

export async function reactivateMailbox(
  db: D1Database,
  address: string,
  userId: number,
  expiresInHours = 24
): Promise<Mailbox | null> {
  const mailbox = await getMailboxRaw(db, address);
  if (!mailbox || mailbox.userId !== userId) return null;
  const now = getCurrentTimestamp();
  const expiresAt = calculateExpiryTimestamp(expiresInHours);
  await db
    .prepare(`UPDATE mailboxes SET expires_at = ?, last_accessed = ? WHERE id = ?`)
    .bind(expiresAt, now, mailbox.id)
    .run();
  return { ...mailbox, expiresAt, lastAccessed: now };
}

export async function updateMailboxMailDomain(
  db: D1Database,
  address: string,
  userId: number,
  mailDomain: string
): Promise<Mailbox | null> {
  const mailbox = await getMailboxRaw(db, address);
  if (!mailbox || mailbox.userId !== userId) return null;
  await db
    .prepare(`UPDATE mailboxes SET mail_domain = ?, last_accessed = ? WHERE id = ?`)
    .bind(mailDomain, getCurrentTimestamp(), mailbox.id)
    .run();
  return { ...mailbox, mailDomain, lastAccessed: getCurrentTimestamp() };
}

export async function backfillMailboxMailDomains(
  db: D1Database,
  defaultDomain: string
): Promise<void> {
  const domain = defaultDomain.trim().toLowerCase();
  if (!domain) return;
  await db
    .prepare(`UPDATE mailboxes SET mail_domain = ? WHERE mail_domain IS NULL OR mail_domain = ''`)
    .bind(domain)
    .run();
}

export async function listActiveMailboxes(db: D1Database, limit = 50): Promise<Mailbox[]> {
  const now = getCurrentTimestamp();
  const results = await db
    .prepare(
      `SELECT id, address, created_at, expires_at, ip_address, last_accessed
       FROM mailboxes WHERE expires_at > ?
       ORDER BY last_accessed DESC LIMIT ?`
    )
    .bind(now, limit)
    .all();
  if (!results.results) return [];
  return results.results.map((row) => mapMailboxRow(row as Record<string, unknown>));
}

/**
 * 删除邮箱
 * @param db 数据库实例
 * @param address 邮箱地址
 */
export async function deleteMailbox(db: D1Database, address: string): Promise<void> {
  // [feat] 由于外键设置了 ON DELETE CASCADE，直接删除邮箱即可级联删除相关邮件和附件
  await db.prepare(`DELETE FROM mailboxes WHERE address = ?`).bind(address).run();
}

/**
 * 清理孤立的附件（没有关联到任何邮件的附件）
 * @param db 数据库实例
 * @returns 删除的附件数量
 */
async function cleanupOrphanedAttachments(db: D1Database): Promise<number> {
    // [refactor] 优化孤立附件的清理逻辑
    try {
        // 一次性查询所有孤立附件及其分块信息
        const orphanedAttachmentsResult = await db.prepare(`
            SELECT a.id 
            FROM attachments a 
            LEFT JOIN emails e ON a.email_id = e.id 
            WHERE e.id IS NULL
        `).all<{ id: string }>();

        if (!orphanedAttachmentsResult.results || orphanedAttachmentsResult.results.length === 0) {
            return 0;
        }

        const attachmentIds = orphanedAttachmentsResult.results.map(row => row.id);
        const placeholders = attachmentIds.map(() => '?').join(',');

        console.log(`找到 ${attachmentIds.length} 个孤立附件，准备清理...`);

        // 批量删除附件分块
        await db.prepare(`DELETE FROM attachment_chunks WHERE attachment_id IN (${placeholders})`).bind(...attachmentIds).run();
        console.log(`已清理孤立附件的所有分块`);

        // 批量删除附件记录
        const deleteResult = await db.prepare(`DELETE FROM attachments WHERE id IN (${placeholders})`).bind(...attachmentIds).run();
        const deletedCount = deleteResult.meta?.changes || 0;
        console.log(`已清理 ${deletedCount} 个孤立附件记录`);

        return deletedCount;
    } catch (error) {
        console.error('清理孤立附件时出错:', error);
        return 0;
    }
}

/**
 * 清理过期邮箱
 * @param db 数据库实例
 * @returns 删除的邮箱数量
 */
export async function cleanupExpiredMailboxes(db: D1Database): Promise<number> {
  const now = getCurrentTimestamp();
  // [refactor] 由于数据库 schema 中设置了 ON DELETE CASCADE，
  // 删除 mailboxes 表中的记录会自动删除 emails, attachments, 和 attachment_chunks 中所有相关的记录。
  // 这大大简化了清理逻辑，并提高了性能。
  const result = await db.prepare(`DELETE FROM mailboxes WHERE expires_at <= ?`).bind(now).run();
  
  // 清理可能由于异常情况产生的孤立附件
  await cleanupOrphanedAttachments(db);
  
  return result.meta?.changes || 0;
}

/**
 * 清理指定用户的过期邮箱（列表接口懒删除，避免等待整点 cron）
 */
export async function cleanupExpiredMailboxesForUser(
  db: D1Database,
  userId: number
): Promise<number> {
  const now = getCurrentTimestamp();
  const result = await db
    .prepare(`DELETE FROM mailboxes WHERE user_id = ? AND expires_at <= ?`)
    .bind(userId, now)
    .run();
  return result.meta?.changes || 0;
}

/**
 * 清理过期邮件
 * @param db 数据库实例
 * @returns 删除的邮件数量
 */
export async function cleanupExpiredMails(db: D1Database): Promise<number> {
  const now = getCurrentTimestamp();
  const oneDayAgo = now - 24 * 60 * 60; // 24小时前的时间戳（秒）
  
  // [refactor] 同样利用 ON DELETE CASCADE 特性简化逻辑
  const result = await db.prepare(`DELETE FROM emails WHERE received_at <= ?`).bind(oneDayAgo).run();
  
  await cleanupOrphanedAttachments(db);
  
  return result.meta?.changes || 0;
}

/**
 * 清理已被阅读的邮件
 * @param db 数据库实例
 * @returns 删除的邮件数量
 */
export async function cleanupReadMails(db: D1Database): Promise<number> {
  // [refactor] 同样利用 ON DELETE CASCADE 特性简化逻辑
  const result = await db.prepare(`DELETE FROM emails WHERE is_read = 1`).run();
  
  await cleanupOrphanedAttachments(db);
  
  return result.meta?.changes || 0;
}

/**
 * 保存邮件
 * @param db 数据库实例
 * @param params 参数
 * @returns 保存的邮件
 */
export async function saveEmail(db: D1Database, params: SaveEmailParams): Promise<Email> {
  try {
    console.log('开始保存邮件...');
    
    const now = getCurrentTimestamp();
    const email: Email = {
      id: generateId(),
      mailboxId: params.mailboxId,
      fromAddress: params.fromAddress,
      fromName: params.fromName || '',
      toAddress: params.toAddress,
      subject: params.subject || '',
      textContent: params.textContent || '',
      htmlContent: params.htmlContent || '',
      receivedAt: now,
      hasAttachments: params.hasAttachments || false,
      isRead: false,
      extractedCode: params.extractedCode ?? null,
      matchedRuleId: params.matchedRuleId ?? null,
      rawContent: params.rawContent ?? null,
    };
    
    console.log('准备插入邮件:', email.id);
    
    await db.prepare(`INSERT INTO emails (id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read, extracted_code, raw_content, matched_rule_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(email.id, email.mailboxId, email.fromAddress, email.fromName, email.toAddress, email.subject, email.textContent, email.htmlContent, email.receivedAt, email.hasAttachments ? 1 : 0, email.isRead ? 1 : 0, email.extractedCode, email.rawContent, email.matchedRuleId).run();
    
    console.log('邮件保存成功:', email.id);
    
    return email;
  } catch (error) {
    console.error('保存邮件失败:', error);
    throw new Error(`保存邮件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 保存附件
 * @param db 数据库实例
 * @param params 参数
 * @returns 保存的附件
 */
export async function saveAttachment(
  db: D1Database,
  params: SaveAttachmentParams,
  options?: SaveAttachmentOptions
): Promise<Attachment> {
  try {
    console.log('开始保存附件...');
    
    const now = getCurrentTimestamp();
    const attachmentId = generateId();

    if (options?.r2Bucket) {
      const r2Key = await storeAttachmentInR2(options.r2Bucket, attachmentId, params.content);
      const attachment: Attachment = {
        id: attachmentId,
        emailId: params.emailId,
        filename: params.filename,
        mimeType: params.mimeType,
        content: '',
        size: params.size,
        createdAt: now,
        isLarge: false,
        chunksCount: 0,
        r2Key,
      };
      await db.prepare(
        `INSERT INTO attachments (id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count, r2_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        attachment.id,
        attachment.emailId,
        attachment.filename,
        attachment.mimeType,
        attachment.content,
        attachment.size,
        attachment.createdAt,
        0,
        0,
        r2Key
      ).run();
      console.log('附件已存入 R2:', attachment.id, r2Key);
      return attachment;
    }
    
    // 检查附件大小，决定是否需要分块存储
    const isLarge = params.content.length > CHUNK_SIZE;
    console.log(`附件大小: ${params.content.length} 字节, 是否为大型附件: ${isLarge}`);
    
    if (isLarge) {
      // 大型附件，需要分块存储
      const contentLength = params.content.length;
      const chunksCount = Math.ceil(contentLength / CHUNK_SIZE);
      console.log(`将附件分为 ${chunksCount} 块存储`);
      
      // 创建附件记录，但不存储内容
      const attachment: Attachment = {
        id: attachmentId,
        emailId: params.emailId,
        filename: params.filename,
        mimeType: params.mimeType,
        content: '', // 大型附件不在主表存储内容
        size: params.size,
        createdAt: now,
        isLarge: true,
        chunksCount: chunksCount
      };
      
      // 插入附件记录
      await db.prepare(`INSERT INTO attachments (id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(attachment.id, attachment.emailId, attachment.filename, attachment.mimeType, attachment.content, attachment.size, attachment.createdAt, attachment.isLarge ? 1 : 0, attachment.chunksCount).run();
      
      // 分块存储附件内容
      for (let i = 0; i < chunksCount; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, contentLength);
        const chunkContent = params.content.substring(start, end);
        const chunkId = generateId();
        
        await db.prepare(`INSERT INTO attachment_chunks (id, attachment_id, chunk_index, content) VALUES (?, ?, ?, ?)`).bind(chunkId, attachment.id, i, chunkContent).run();
        console.log(`保存附件块 ${i+1}/${chunksCount}`);
      }
      
      console.log('大型附件保存成功:', attachment.id);
      return attachment;
    } else {
      // 小型附件，直接存储
      const attachment: Attachment = {
        id: attachmentId,
        emailId: params.emailId,
        filename: params.filename,
        mimeType: params.mimeType,
        content: params.content,
        size: params.size,
        createdAt: now,
        isLarge: false,
        chunksCount: 0
      };
      
      await db.prepare(`INSERT INTO attachments (id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(attachment.id, attachment.emailId, attachment.filename, attachment.mimeType, attachment.content, attachment.size, attachment.createdAt, attachment.isLarge ? 1 : 0, attachment.chunksCount).run();
      
      console.log('小型附件保存成功:', attachment.id);
      return attachment;
    }
  } catch (error) {
    console.error('保存附件失败:', error);
    throw new Error(`保存附件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function mapEmailListItem(result: Record<string, unknown>): EmailListItem {
  return {
    id: result.id as string,
    mailboxId: result.mailbox_id as string,
    fromAddress: result.from_address as string,
    fromName: result.from_name as string,
    toAddress: result.to_address as string,
    subject: result.subject as string,
    receivedAt: result.received_at as number,
    hasAttachments: !!result.has_attachments,
    isRead: !!result.is_read,
    extractedCode: (result.extracted_code as string | null) ?? null,
    matchedRuleId: (result.matched_rule_id as number | null) ?? null,
    matchedRuleDomain: (result.matched_rule_domain as string | null) ?? null,
    matchedRuleRemark: (result.matched_rule_remark as string | null) ?? null,
  };
}

/**
 * 获取邮件列表
 * @param db 数据库实例
 * @param mailboxId 邮箱ID
 * @param opts.domain 若指定，仅返回发往 localPart@domain 的邮件（多域名同前缀隔离展示）
 */
export async function getEmails(
  db: D1Database,
  mailboxId: string,
  opts?: { localPart?: string; domain?: string }
): Promise<EmailListItem[]> {
  const domain = opts?.domain?.trim().toLowerCase();
  const localPart = opts?.localPart?.trim().toLowerCase();
  const filterByDomain = !!(domain && localPart);

  const baseSelect = `
    SELECT e.id, e.mailbox_id, e.from_address, e.from_name, e.to_address, e.subject,
           e.received_at, e.has_attachments, e.is_read, e.extracted_code, e.matched_rule_id,
           er.domain AS matched_rule_domain, er.remark AS matched_rule_remark
    FROM emails e
    LEFT JOIN extract_rules er ON e.matched_rule_id = er.id`;

  const results = filterByDomain
    ? await db
        .prepare(
          `${baseSelect}
     LEFT JOIN mailboxes m ON m.id = e.mailbox_id
     WHERE e.mailbox_id = ?
       AND (
         LOWER(e.to_address) = ?
         OR (
           INSTR(LOWER(e.to_address), '@') > 0
           AND LOWER(SUBSTR(e.to_address, 1, INSTR(e.to_address, '@') - 1)) = ?
           AND LOWER(SUBSTR(e.to_address, INSTR(e.to_address, '@') + 1)) = ?
         )
         OR (
           INSTR(e.to_address, '@') = 0
           AND LOWER(e.to_address) = ?
           AND LOWER(COALESCE(m.mail_domain, '')) = ?
         )
       )
     ORDER BY e.received_at DESC`
        )
        .bind(mailboxId, `${localPart}@${domain}`, localPart, domain, localPart, domain)
        .all()
    : await db
        .prepare(
          `${baseSelect}
     WHERE e.mailbox_id = ?
     ORDER BY e.received_at DESC`
        )
        .bind(mailboxId)
        .all();
  
  if (!results.results) return [];
  
  return results.results.map((result) => mapEmailListItem(result as Record<string, unknown>));
}

/**
 * 获取邮件详情
 * @param db 数据库实例
 * @param id 邮件ID
 * @returns 邮件详情
 */
export async function getEmail(db: D1Database, id: string, markRead = true): Promise<Email | null> {
  const result = await db.prepare(
    `SELECT e.id, e.mailbox_id, e.from_address, e.from_name, e.to_address, e.subject,
            e.text_content, e.html_content, e.received_at, e.has_attachments, e.is_read,
            e.extracted_code, e.raw_content, e.matched_rule_id,
            er.domain AS matched_rule_domain, er.remark AS matched_rule_remark
     FROM emails e
     LEFT JOIN extract_rules er ON e.matched_rule_id = er.id
     WHERE e.id = ?`
  ).bind(id).first();
  
  if (!result) return null;

  const wasRead = !!result.is_read;
  if (markRead && !wasRead) {
    await db.prepare(`UPDATE emails SET is_read = 1 WHERE id = ?`).bind(id).run();
  }
  
  return {
    id: result.id as string,
    mailboxId: result.mailbox_id as string,
    fromAddress: result.from_address as string,
    fromName: result.from_name as string,
    toAddress: result.to_address as string,
    subject: result.subject as string,
    textContent: result.text_content as string,
    htmlContent: result.html_content as string,
    receivedAt: result.received_at as number,
    hasAttachments: !!result.has_attachments,
    isRead: markRead || wasRead,
    extractedCode: (result.extracted_code as string | null) ?? null,
    matchedRuleId: (result.matched_rule_id as number | null) ?? null,
    matchedRuleDomain: (result.matched_rule_domain as string | null) ?? null,
    matchedRuleRemark: (result.matched_rule_remark as string | null) ?? null,
    rawContent: (result.raw_content as string | null) ?? null,
  };
}

export interface EmailReExtractRow {
  id: string;
  fromAddress: string;
  subject: string;
  textContent: string;
  htmlContent: string;
  mailboxUserId: number | null;
}

export async function getEmailReExtractRow(
  db: D1Database,
  emailId: string
): Promise<EmailReExtractRow | null> {
  const result = await db
    .prepare(
      `SELECT e.id, e.from_address, e.subject, e.text_content, e.html_content, m.user_id AS mailbox_user_id
       FROM emails e
       JOIN mailboxes m ON e.mailbox_id = m.id
       WHERE e.id = ?`
    )
    .bind(emailId)
    .first();

  if (!result) return null;

  return {
    id: result.id as string,
    fromAddress: result.from_address as string,
    subject: (result.subject as string) ?? '',
    textContent: (result.text_content as string) ?? '',
    htmlContent: (result.html_content as string) ?? '',
    mailboxUserId: (result.mailbox_user_id as number | null) ?? null,
  };
}

export async function listEmailsWithoutExtractedCode(
  db: D1Database,
  opts: { userId?: number; domain?: string; limit?: number }
): Promise<EmailReExtractRow[]> {
  const limit = opts.limit ?? 100;
  let sql = `
    SELECT e.id, e.from_address, e.subject, e.text_content, e.html_content, m.user_id AS mailbox_user_id
    FROM emails e
    JOIN mailboxes m ON e.mailbox_id = m.id
    WHERE (e.extracted_code IS NULL OR e.extracted_code = '')`;
  const binds: unknown[] = [];

  if (opts.userId != null) {
    sql += ` AND m.user_id = ?`;
    binds.push(opts.userId);
  }

  if (opts.domain) {
    sql += ` AND LOWER(e.from_address) LIKE ?`;
    binds.push(`%@${opts.domain.toLowerCase()}`);
  }

  sql += ` ORDER BY e.received_at DESC LIMIT ?`;
  binds.push(limit);

  const results = await db.prepare(sql).bind(...binds).all();
  if (!results.results) return [];

  return results.results.map((row) => ({
    id: row.id as string,
    fromAddress: row.from_address as string,
    subject: (row.subject as string) ?? '',
    textContent: (row.text_content as string) ?? '',
    htmlContent: (row.html_content as string) ?? '',
    mailboxUserId: (row.mailbox_user_id as number | null) ?? null,
  }));
}

export async function updateEmailExtractResult(
  db: D1Database,
  emailId: string,
  extractedCode: string | null,
  matchedRuleId: number | null
): Promise<void> {
  await db
    .prepare(`UPDATE emails SET extracted_code = ?, matched_rule_id = ? WHERE id = ?`)
    .bind(extractedCode, matchedRuleId, emailId)
    .run();
}

export async function getEmailRawContent(db: D1Database, id: string): Promise<string | null> {
  const result = await db
    .prepare(
      `SELECT raw_content, from_address, from_name, to_address, subject, text_content, html_content, received_at
       FROM emails WHERE id = ?`
    )
    .bind(id)
    .first();

  if (!result) return null;

  const stored = result.raw_content as string | null;
  if (stored) return stored;

  return reconstructRawEmail({
    fromAddress: result.from_address as string,
    fromName: (result.from_name as string) || '',
    toAddress: result.to_address as string,
    subject: (result.subject as string) || '',
    textContent: (result.text_content as string) || '',
    htmlContent: (result.html_content as string) || '',
    receivedAt: result.received_at as number,
  });
}

export function reconstructRawEmail(email: {
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  subject: string;
  textContent?: string;
  htmlContent?: string;
  receivedAt: number;
}): string {
  const date = new Date(email.receivedAt * 1000).toUTCString();
  const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
  let raw = `From: ${from}\r\n`;
  raw += `To: ${email.toAddress}\r\n`;
  raw += `Subject: ${email.subject}\r\n`;
  raw += `Date: ${date}\r\n`;
  raw += `MIME-Version: 1.0\r\n`;
  if (email.htmlContent) {
    raw += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
    raw += email.htmlContent;
  } else {
    raw += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
    raw += email.textContent || '';
  }
  return raw;
}

/**
 * 获取附件列表
 * @param db 数据库实例
 * @param emailId 邮件ID
 * @returns 附件列表
 */
export async function getAttachments(db: D1Database, emailId: string): Promise<AttachmentListItem[]> {
  const results = await db.prepare(`SELECT id, email_id, filename, mime_type, size, created_at, is_large, chunks_count FROM attachments WHERE email_id = ? ORDER BY created_at ASC`).bind(emailId).all();
  
  if (!results.results) return [];
  
  return results.results.map(result => ({
    id: result.id as string,
    emailId: result.email_id as string,
    filename: result.filename as string,
    mimeType: result.mime_type as string,
    size: result.size as number,
    createdAt: result.created_at as number,
    isLarge: !!result.is_large,
    chunksCount: result.chunks_count as number
  }));
}

/**
 * 获取附件详情
 * @param db 数据库实例
 * @param id 附件ID
 * @returns 附件详情
 */
export async function getAttachment(db: D1Database, id: string): Promise<Attachment | null> {
  const result = await db.prepare(
    `SELECT id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count, r2_key FROM attachments WHERE id = ?`
  ).bind(id).first();
  
  if (!result) return null;
  
  const isLarge = !!result.is_large;
  const r2Key = (result.r2_key as string | null) ?? null;
  let content = result.content as string;
  
  // R2-backed attachments keep empty content in D1
  if (!r2Key && isLarge) {
    const chunksCount = result.chunks_count as number;
    content = await getAttachmentContent(db, id, chunksCount);
  }
  
  return {
    id: result.id as string,
    emailId: result.email_id as string,
    filename: result.filename as string,
    mimeType: result.mime_type as string,
    content: content,
    size: result.size as number,
    createdAt: result.created_at as number,
    isLarge: isLarge,
    chunksCount: result.chunks_count as number,
    r2Key,
  };
}

/**
 * 获取大型附件的内容
 * @param db 数据库实例
 * @param attachmentId 附件ID
 * @param chunksCount 块数量
 * @returns 完整的附件内容
 */
async function getAttachmentContent(db: D1Database, attachmentId: string, chunksCount: number): Promise<string> {
  let content = '';
  
  // 按顺序获取所有块
  for (let i = 0; i < chunksCount; i++) {
    const chunk = await db.prepare(`SELECT content FROM attachment_chunks WHERE attachment_id = ? AND chunk_index = ?`).bind(attachmentId, i).first();
    if (chunk && chunk.content) {
      content += chunk.content as string;
    }
  }
  
  return content;
}

/**
 * 删除邮件
 * @param db 数据库实例
 * @param id 邮件ID
 */
export async function deleteEmail(db: D1Database, id: string): Promise<void> {
  // [refactor] 由于外键设置了 ON DELETE CASCADE，直接删除邮件即可
  await db.prepare(`DELETE FROM emails WHERE id = ?`).bind(id).run();
}

export async function deleteUserMailboxEmails(
  db: D1Database,
  userId: number,
  mailboxAddress: string,
  options: { ids?: string[]; all?: boolean }
): Promise<number | null> {
  const mailbox = await getMailboxRaw(db, mailboxAddress);
  if (!mailbox || mailbox.userId !== userId) return null;

  if (options.all) {
    const result = await db.prepare(`DELETE FROM emails WHERE mailbox_id = ?`).bind(mailbox.id).run();
    return result.meta?.changes ?? 0;
  }

  if (options.ids && options.ids.length > 0) {
    const placeholders = options.ids.map(() => '?').join(',');
    const result = await db
      .prepare(`DELETE FROM emails WHERE mailbox_id = ? AND id IN (${placeholders})`)
      .bind(mailbox.id, ...options.ids)
      .run();
    return result.meta?.changes ?? 0;
  }

  return 0;
}

export async function deleteUserSentEmails(
  db: D1Database,
  userId: number,
  options: { ids?: number[]; all?: boolean }
): Promise<number> {
  if (options.all) {
    const result = await db.prepare(`DELETE FROM sent_emails WHERE user_id = ?`).bind(userId).run();
    return result.meta?.changes ?? 0;
  }

  if (options.ids && options.ids.length > 0) {
    const placeholders = options.ids.map(() => '?').join(',');
    const result = await db
      .prepare(`DELETE FROM sent_emails WHERE user_id = ? AND id IN (${placeholders})`)
      .bind(userId, ...options.ids)
      .run();
    return result.meta?.changes ?? 0;
  }

  return 0;
}

// ─── API Token ───────────────────────────────────────────────

function maskStoredApiToken(stored: string): string {
  if (stored.length <= 8) return '••••••••';
  return `••••${stored.slice(-4)}`;
}

export async function verifyApiToken(db: D1Database, token: string): Promise<boolean> {
  const nowMs = Date.now();
  const tokenHash = await hashToken(token);

  const hashed = await db
    .prepare(`SELECT id FROM api_tokens WHERE token = ? AND expires_at > ?`)
    .bind(tokenHash, nowMs)
    .first<{ id: number }>();
  if (hashed) return true;

  // Upgrade legacy plaintext tokens on successful verification
  const plaintext = await db
    .prepare(`SELECT id FROM api_tokens WHERE token = ? AND expires_at > ?`)
    .bind(token, nowMs)
    .first<{ id: number }>();
  if (!plaintext) return false;

  await db.prepare(`UPDATE api_tokens SET token = ? WHERE id = ?`).bind(tokenHash, plaintext.id).run();
  return true;
}

export async function listApiTokens(db: D1Database): Promise<ApiToken[]> {
  const results = await db.prepare(
    `SELECT id, token, name, expires_at, created_at FROM api_tokens ORDER BY created_at DESC`
  ).all();
  if (!results.results) return [];
  return results.results.map(row => ({
    id: row.id as number,
    token: maskStoredApiToken(row.token as string),
    name: row.name as string | null,
    expiresAt: row.expires_at as number,
    createdAt: row.created_at as number,
  }));
}

export async function createApiToken(db: D1Database, params: CreateApiTokenParams): Promise<ApiToken> {
  const token = generateApiToken();
  const tokenHash = await hashToken(token);
  const expiresAt = Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000;
  const result = await db.prepare(
    `INSERT INTO api_tokens (token, name, expires_at) VALUES (?, ?, ?) RETURNING id, name, expires_at, created_at`
  ).bind(tokenHash, params.name ?? null, expiresAt).first();
  return {
    id: result!.id as number,
    token,
    name: result!.name as string | null,
    expiresAt: result!.expires_at as number,
    createdAt: result!.created_at as number,
  };
}

export async function deleteApiToken(db: D1Database, id: number): Promise<void> {
  await db.prepare(`DELETE FROM api_tokens WHERE id = ?`).bind(id).run();
}

// ─── Extract Rules ───────────────────────────────────────────

const EXTRACT_RULE_COLUMNS =
  'id, domain, regex, priority, enabled, created_at, user_id, remark';

function mapExtractRuleRow(row: Record<string, unknown>): ExtractRule {
  return {
    id: row.id as number,
    domain: row.domain as string,
    regex: row.regex as string,
    priority: row.priority as number,
    enabled: !!row.enabled,
    createdAt: row.created_at as number,
    userId: (row.user_id as number | null) ?? null,
    remark: (row.remark as string | null) ?? null,
  };
}

function mapUserExtractRuleRow(row: Record<string, unknown>): UserExtractRule {
  return {
    ...mapExtractRuleRow(row),
    username: row.username as string,
  };
}

export async function listExtractRules(db: D1Database): Promise<ExtractRule[]> {
  const results = await db.prepare(
    `SELECT ${EXTRACT_RULE_COLUMNS} FROM extract_rules
     WHERE user_id IS NULL
     ORDER BY priority DESC, id ASC`
  ).all();
  if (!results.results) return [];
  return results.results.map((row) => mapExtractRuleRow(row as Record<string, unknown>));
}

export async function listUserExtractRules(db: D1Database, userId: number): Promise<ExtractRule[]> {
  const results = await db.prepare(
    `SELECT ${EXTRACT_RULE_COLUMNS} FROM extract_rules
     WHERE user_id = ?
     ORDER BY priority DESC, id ASC`
  ).bind(userId).all();
  if (!results.results) return [];
  return results.results.map((row) => mapExtractRuleRow(row as Record<string, unknown>));
}

export async function listAllUserExtractRules(db: D1Database): Promise<UserExtractRule[]> {
  const results = await db.prepare(
    `SELECT er.id, er.domain, er.regex, er.priority, er.enabled, er.created_at, er.user_id, er.remark, u.username
     FROM extract_rules er
     JOIN users u ON er.user_id = u.id
     WHERE er.user_id IS NOT NULL
     ORDER BY er.id DESC`
  ).all();
  if (!results.results) return [];
  return results.results.map((row) => mapUserExtractRuleRow(row as Record<string, unknown>));
}

export function sortExtractRulesForDomain(rules: ExtractRule[], senderDomain: string): ExtractRule[] {
  return [...rules].sort((a, b) => {
    const aSpecific = a.domain !== '*' && a.domain === senderDomain ? 1 : 0;
    const bSpecific = b.domain !== '*' && b.domain === senderDomain ? 1 : 0;
    if (bSpecific !== aSpecific) return bSpecific - aSpecific;
    const aScope = a.userId != null ? 1 : 0;
    const bScope = b.userId != null ? 1 : 0;
    if (bScope !== aScope) return bScope - aScope;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id - b.id;
  });
}

export async function getEnabledExtractRules(
  db: D1Database,
  senderDomain: string,
  userId?: number | null
): Promise<ExtractRule[]> {
  const globalResults = await db.prepare(
    `SELECT ${EXTRACT_RULE_COLUMNS} FROM extract_rules
     WHERE enabled = 1 AND user_id IS NULL AND (domain = ? OR domain = '*')`
  ).bind(senderDomain).all();

  let userRules: ExtractRule[] = [];
  if (userId != null) {
    const userResults = await db.prepare(
      `SELECT ${EXTRACT_RULE_COLUMNS} FROM extract_rules
       WHERE enabled = 1 AND user_id = ? AND (domain = ? OR domain = '*')`
    ).bind(userId, senderDomain).all();
    if (userResults.results) {
      userRules = userResults.results.map((row) => mapExtractRuleRow(row as Record<string, unknown>));
    }
  }

  const globalRules = globalResults.results
    ? globalResults.results.map((row) => mapExtractRuleRow(row as Record<string, unknown>))
    : [];

  return sortExtractRulesForDomain([...userRules, ...globalRules], senderDomain);
}

export async function getExtractRuleById(db: D1Database, id: number): Promise<ExtractRule | null> {
  const result = await db.prepare(
    `SELECT ${EXTRACT_RULE_COLUMNS} FROM extract_rules WHERE id = ?`
  ).bind(id).first();
  return result ? mapExtractRuleRow(result as Record<string, unknown>) : null;
}

export async function createExtractRule(db: D1Database, params: SaveExtractRuleParams): Promise<ExtractRule> {
  const result = await db.prepare(
    `INSERT INTO extract_rules (domain, regex, priority, enabled, user_id, remark) VALUES (?, ?, ?, ?, ?, ?)
     RETURNING ${EXTRACT_RULE_COLUMNS}`
  ).bind(
    params.domain || '*',
    params.regex,
    params.priority ?? 0,
    params.enabled !== false ? 1 : 0,
    params.userId ?? null,
    params.remark ?? null
  ).first();
  return mapExtractRuleRow(result as Record<string, unknown>);
}

export async function updateExtractRule(db: D1Database, id: number, params: SaveExtractRuleParams): Promise<ExtractRule | null> {
  const existing = await getExtractRuleById(db, id);
  if (!existing) return null;
  const remark = params.remark !== undefined ? (params.remark ?? null) : (existing.remark ?? null);
  await db.prepare(
    `UPDATE extract_rules SET domain = ?, regex = ?, priority = ?, enabled = ?, remark = ? WHERE id = ?`
  ).bind(
    params.domain || '*',
    params.regex,
    params.priority ?? 0,
    params.enabled !== false ? 1 : 0,
    remark,
    id
  ).run();
  return getExtractRuleById(db, id);
}

export async function updateUserExtractRule(
  db: D1Database,
  id: number,
  userId: number,
  params: SaveExtractRuleParams
): Promise<ExtractRule | null> {
  const existing = await getExtractRuleById(db, id);
  if (!existing || existing.userId !== userId) return null;
  return updateExtractRule(db, id, params);
}

export async function updateGlobalExtractRule(
  db: D1Database,
  id: number,
  params: SaveExtractRuleParams
): Promise<ExtractRule | null> {
  const existing = await getExtractRuleById(db, id);
  if (!existing || existing.userId != null) return null;
  return updateExtractRule(db, id, params);
}

export async function deleteExtractRule(db: D1Database, id: number): Promise<void> {
  await db.prepare(`DELETE FROM extract_rules WHERE id = ?`).bind(id).run();
}

export async function deleteUserExtractRule(db: D1Database, id: number, userId: number): Promise<boolean> {
  const existing = await getExtractRuleById(db, id);
  if (!existing || existing.userId !== userId) return false;
  await deleteExtractRule(db, id);
  return true;
}

export async function deleteGlobalExtractRule(db: D1Database, id: number): Promise<boolean> {
  const existing = await getExtractRuleById(db, id);
  if (!existing || existing.userId != null) return false;
  await deleteExtractRule(db, id);
  return true;
}

export async function deleteAnyUserExtractRule(db: D1Database, id: number): Promise<boolean> {
  const existing = await getExtractRuleById(db, id);
  if (!existing || existing.userId == null) return false;
  await deleteExtractRule(db, id);
  return true;
}

// ─── Sent Emails ─────────────────────────────────────────────

const SENT_EMAIL_LIST_COLUMNS = `id, to_email, subject, status, created_at, user_id, token_id,
  from_email, attachment_count, error_message`;

const SENT_EMAIL_DETAIL_COLUMNS = `${SENT_EMAIL_LIST_COLUMNS}, body_text, body_html, attachments_json`;

function mapSentEmailRow(row: Record<string, unknown>, includeDetail = false): SentEmail {
  const email: SentEmail = {
    id: row.id as number,
    toEmail: row.to_email as string,
    subject: row.subject as string,
    status: row.status as string,
    createdAt: row.created_at as number,
    userId: (row.user_id as number | null) ?? null,
    tokenId: (row.token_id as number | null) ?? null,
    fromEmail: (row.from_email as string | null) ?? null,
    attachmentCount: (row.attachment_count as number | null) ?? 0,
    errorMessage: (row.error_message as string | null) ?? null,
  };
  if (includeDetail) {
    email.bodyText = (row.body_text as string | null) ?? null;
    email.bodyHtml = (row.body_html as string | null) ?? null;
    const attachmentsJson = row.attachments_json as string | null;
    if (attachmentsJson) {
      try {
        email.attachments = JSON.parse(attachmentsJson) as SentEmail['attachments'];
      } catch {
        email.attachments = [];
      }
    }
  }
  return email;
}

export interface SaveSentEmailParams {
  toEmail: string;
  subject: string;
  status?: string;
  userId?: number | null;
  tokenId?: number | null;
  fromEmail?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  errorMessage?: string | null;
  attachments?: SendAttachment[] | null;
}

export async function saveSentEmail(db: D1Database, params: SaveSentEmailParams): Promise<SentEmail> {
  const attachments = params.attachments ?? [];
  const attachmentsJson = attachments.length > 0 ? JSON.stringify(attachments) : null;
  const result = await db.prepare(
    `INSERT INTO sent_emails (
       to_email, subject, status, user_id, token_id, from_email, body_text, body_html,
       error_message, attachment_count, attachments_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING ${SENT_EMAIL_DETAIL_COLUMNS}`
  ).bind(
    params.toEmail,
    params.subject,
    params.status ?? 'sent',
    params.userId ?? null,
    params.tokenId ?? null,
    params.fromEmail ?? null,
    params.bodyText ?? null,
    params.bodyHtml ?? null,
    params.errorMessage ?? null,
    attachments.length,
    attachmentsJson
  ).first();
  return mapSentEmailRow(result as Record<string, unknown>, true);
}

export async function listSentEmails(db: D1Database, limit = 100): Promise<SentEmail[]> {
  const results = await db.prepare(
    `SELECT ${SENT_EMAIL_LIST_COLUMNS} FROM sent_emails ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  if (!results.results) return [];
  return results.results.map(row => mapSentEmailRow(row as Record<string, unknown>));
}

export interface ListUserSentEmailsOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface PaginatedSentEmails {
  emails: SentEmail[];
  total: number;
}

export async function listUserSentEmails(
  db: D1Database,
  userId: number,
  options: ListUserSentEmailsOptions = {}
): Promise<PaginatedSentEmails> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const searchTerm = (options.search ?? '').trim();

  const whereClauses = ['user_id = ?'];
  const bindings: unknown[] = [userId];

  if (searchTerm) {
    const sanitized = searchTerm.replace(/[%_]/g, '');
    if (sanitized) {
      whereClauses.push('(to_email LIKE ? OR from_email LIKE ?)');
      bindings.push(`%${sanitized}%`, `%${sanitized}%`);
    }
  }

  const where = whereClauses.join(' AND ');

  const countRow = await db
    .prepare(`SELECT COUNT(*) as count FROM sent_emails WHERE ${where}`)
    .bind(...bindings)
    .first<{ count: number }>();

  const results = await db
    .prepare(
      `SELECT ${SENT_EMAIL_LIST_COLUMNS}
       FROM sent_emails
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...bindings, limit, offset)
    .all();

  const emails = results.results
    ? results.results.map((row) => mapSentEmailRow(row as Record<string, unknown>))
    : [];

  return { emails, total: countRow?.count ?? 0 };
}

export async function getUserSentEmailById(
  db: D1Database,
  userId: number,
  id: number
): Promise<SentEmail | null> {
  const row = await db.prepare(
    `SELECT ${SENT_EMAIL_DETAIL_COLUMNS} FROM sent_emails WHERE user_id = ? AND id = ?`
  ).bind(userId, id).first();
  if (!row) return null;
  return mapSentEmailRow(row as Record<string, unknown>, true);
}

// ─── Admin Stats & Polling ───────────────────────────────────

export async function getAdminStats(db: D1Database): Promise<AdminStats> {
  const now = getCurrentTimestamp();
  const startOfDay = now - (now % 86400);
  const todayDate = getTodayUsageDate();
  const nowMs = Date.now();

  const [
    totalUsers,
    activeUsers,
    totalMailboxes,
    activeMailboxes,
    received,
    sent,
    activeUsersToday,
    activeUserTokens,
  ] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as count FROM users`).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM users WHERE enabled = 1`).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM mailboxes`).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM mailboxes WHERE expires_at > ?`).bind(now).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM emails WHERE received_at >= ?`).bind(startOfDay).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM sent_emails WHERE created_at >= ?`).bind(startOfDay).first<{ count: number }>(),
    db.prepare(
      `SELECT COUNT(DISTINCT user_id) as count FROM (
         SELECT user_id FROM daily_usage
         WHERE usage_date = ? AND (send_count > 0 OR lease_count > 0)
         UNION
         SELECT user_id FROM sent_emails
         WHERE created_at >= ? AND user_id IS NOT NULL
         UNION
         SELECT m.user_id FROM emails e
         INNER JOIN mailboxes m ON e.mailbox_id = m.id
         WHERE e.received_at >= ? AND m.user_id IS NOT NULL
       )`
    ).bind(todayDate, startOfDay, startOfDay).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM user_tokens WHERE expires_at > ?`).bind(nowMs).first<{ count: number }>(),
  ]);

  return {
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    totalMailboxes: totalMailboxes?.count ?? 0,
    activeMailboxes: activeMailboxes?.count ?? 0,
    receivedToday: received?.count ?? 0,
    sentToday: sent?.count ?? 0,
    activeUsersToday: activeUsersToday?.count ?? 0,
    activeUserTokens: activeUserTokens?.count ?? 0,
  };
}

export interface PolledEmail {
  id: string;
  extractedCode: string | null;
  subject: string;
  fromAddress: string;
  receivedAt: number;
}

export interface ApiMailCursor {
  emailId: string;
  receivedAt: number;
}

export async function getMailboxApiMailCursor(
  db: D1Database,
  mailboxId: string
): Promise<ApiMailCursor | null> {
  const result = await db.prepare(
    `SELECT last_api_mail_email_id, last_api_mail_received_at FROM mailboxes WHERE id = ?`
  ).bind(mailboxId).first();

  if (!result?.last_api_mail_email_id) return null;

  return {
    emailId: result.last_api_mail_email_id as string,
    receivedAt: result.last_api_mail_received_at as number,
  };
}

export async function setMailboxApiMailCursor(
  db: D1Database,
  mailboxId: string,
  emailId: string,
  receivedAt: number
): Promise<void> {
  await db.prepare(
    `UPDATE mailboxes SET last_api_mail_email_id = ?, last_api_mail_received_at = ? WHERE id = ?`
  ).bind(emailId, receivedAt, mailboxId).run();
}

function mapPolledEmail(result: Record<string, unknown>): PolledEmail {
  return {
    id: result.id as string,
    extractedCode: result.extracted_code as string | null,
    subject: result.subject as string,
    fromAddress: result.from_address as string,
    receivedAt: result.received_at as number,
  };
}

export async function findLatestEmailWithCode(
  db: D1Database,
  mailboxId: string,
  sinceTimestamp: number,
  excludeAfter?: ApiMailCursor | null
): Promise<PolledEmail | null> {
  const result = excludeAfter
    ? await db.prepare(
        `SELECT id, extracted_code, subject, from_address, received_at FROM emails
         WHERE mailbox_id = ? AND received_at >= ?
           AND (received_at > ? OR (received_at = ? AND id != ?))
           AND extracted_code IS NOT NULL
         ORDER BY received_at DESC LIMIT 1`
      ).bind(
        mailboxId,
        sinceTimestamp,
        excludeAfter.receivedAt,
        excludeAfter.receivedAt,
        excludeAfter.emailId
      ).first()
    : await db.prepare(
        `SELECT id, extracted_code, subject, from_address, received_at FROM emails
         WHERE mailbox_id = ? AND received_at >= ? AND extracted_code IS NOT NULL
         ORDER BY received_at DESC LIMIT 1`
      ).bind(mailboxId, sinceTimestamp).first();

  if (!result) return null;

  return mapPolledEmail(result as Record<string, unknown>);
}

export async function findLatestEmail(
  db: D1Database,
  mailboxId: string,
  sinceTimestamp: number,
  excludeAfter?: ApiMailCursor | null
): Promise<PolledEmail | null> {
  const result = excludeAfter
    ? await db.prepare(
        `SELECT id, extracted_code, subject, from_address, received_at FROM emails
         WHERE mailbox_id = ? AND received_at >= ?
           AND (received_at > ? OR (received_at = ? AND id != ?))
         ORDER BY received_at DESC LIMIT 1`
      ).bind(
        mailboxId,
        sinceTimestamp,
        excludeAfter.receivedAt,
        excludeAfter.receivedAt,
        excludeAfter.emailId
      ).first()
    : await db.prepare(
        `SELECT id, extracted_code, subject, from_address, received_at FROM emails
         WHERE mailbox_id = ? AND received_at >= ?
         ORDER BY received_at DESC LIMIT 1`
      ).bind(mailboxId, sinceTimestamp).first();

  if (!result) return null;

  return mapPolledEmail(result as Record<string, unknown>);
}

export async function findInstantLatestEmailWithCode(
  db: D1Database,
  mailboxId: string
): Promise<PolledEmail | null> {
  const result = await db
    .prepare(
      `SELECT id, extracted_code, subject, from_address, received_at FROM emails
       WHERE mailbox_id = ? AND extracted_code IS NOT NULL
       ORDER BY received_at DESC LIMIT 1`
    )
    .bind(mailboxId)
    .first();

  if (!result) return null;
  return mapPolledEmail(result as Record<string, unknown>);
}

export async function findInstantLatestEmail(
  db: D1Database,
  mailboxId: string
): Promise<(PolledEmail & { textContent?: string; htmlContent?: string }) | null> {
  const result = await db
    .prepare(
      `SELECT id, extracted_code, subject, from_address, received_at, text_content, html_content FROM emails
       WHERE mailbox_id = ?
       ORDER BY received_at DESC LIMIT 1`
    )
    .bind(mailboxId)
    .first();

  if (!result) return null;
  return {
    ...mapPolledEmail(result as Record<string, unknown>),
    textContent: (result.text_content as string) || '',
    htmlContent: (result.html_content as string) || '',
  };
}

// ─── Users & Auth ────────────────────────────────────────────

export async function getUserById(db: D1Database, id: number): Promise<User | null> {
  const result = await db.prepare(
    `SELECT id, username, role, daily_send_quota, rate_limit_per_min, rate_limit_burst, enabled, created_at, last_login_at FROM users WHERE id = ?`
  ).bind(id).first();
  return result ? mapUser(result as Record<string, unknown>) : null;
}

export async function getUserByUsername(db: D1Database, username: string): Promise<User | null> {
  const result = await db.prepare(
    `SELECT id, username, role, daily_send_quota, rate_limit_per_min, rate_limit_burst, enabled, created_at, last_login_at FROM users WHERE username = ?`
  ).bind(username).first();
  return result ? mapUser(result as Record<string, unknown>) : null;
}

export async function listUsers(db: D1Database): Promise<User[]> {
  const results = await db.prepare(
    `SELECT id, username, role, daily_send_quota, rate_limit_per_min, rate_limit_burst, enabled, created_at, last_login_at FROM users ORDER BY created_at ASC`
  ).all();
  if (!results.results) return [];
  return results.results.map((row) => mapUser(row as Record<string, unknown>));
}

export async function createUser(db: D1Database, params: CreateUserParams): Promise<User> {
  const passwordHash = await hashPassword(params.password);
  const rateLimitPerMin = params.rateLimitPerMin ?? 60;
  const rateLimitBurst =
    params.rateLimitBurst != null && params.rateLimitBurst > 0 ? params.rateLimitBurst : null;
  const result = await db.prepare(
    `INSERT INTO users (username, password_hash, role, daily_send_quota, rate_limit_per_min, rate_limit_burst, enabled)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     RETURNING id, username, role, daily_send_quota, rate_limit_per_min, rate_limit_burst, enabled, created_at, last_login_at`
  ).bind(
    params.username,
    passwordHash,
    params.role ?? 'user',
    params.dailySendQuota ?? 50,
    rateLimitPerMin,
    rateLimitBurst
  ).first();
  return mapUser(result as Record<string, unknown>);
}

export async function updateUser(db: D1Database, id: number, params: UpdateUserParams): Promise<User | null> {
  const existing = await getUserById(db, id);
  if (!existing) return null;

  if (params.password) {
    const passwordHash = await hashPassword(params.password);
    await db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(passwordHash, id).run();
  }

  await db.prepare(
    `UPDATE users SET role = COALESCE(?, role), daily_send_quota = COALESCE(?, daily_send_quota), enabled = COALESCE(?, enabled) WHERE id = ?`
  ).bind(
    params.role ?? null,
    params.dailySendQuota ?? null,
    params.enabled === undefined ? null : (params.enabled ? 1 : 0),
    id
  ).run();

  if (params.rateLimitPerMin !== undefined) {
    await db.prepare(`UPDATE users SET rate_limit_per_min = ? WHERE id = ?`)
      .bind(params.rateLimitPerMin ?? 60, id)
      .run();
  }
  if (params.rateLimitBurst !== undefined) {
    const burst = params.rateLimitBurst != null && params.rateLimitBurst > 0 ? params.rateLimitBurst : null;
    await db.prepare(`UPDATE users SET rate_limit_burst = ? WHERE id = ?`).bind(burst, id).run();
  }

  return getUserById(db, id);
}

export async function deleteUser(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function updateUserLastLogin(db: D1Database, id: number): Promise<void> {
  await db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).bind(getCurrentTimestamp(), id).run();
}

export async function verifyUserToken(
  db: D1Database,
  token: string
): Promise<{ userId: number; tokenId: number; scopes: TokenScope[] } | null> {
  const tokenHash = await hashToken(token);
  const nowMs = Date.now();
  const result = await db.prepare(
    `SELECT id, user_id, scopes, last_used_at FROM user_tokens WHERE token_hash = ? AND expires_at > ?`
  ).bind(tokenHash, nowMs).first();

  if (!result) return null;

  const nowSec = getCurrentTimestamp();
  if (shouldTouchTokenLastUsed(result.last_used_at as number | null, nowSec)) {
    await db.prepare(`UPDATE user_tokens SET last_used_at = ? WHERE id = ?`).bind(nowSec, result.id).run();
  }

  return {
    userId: result.user_id as number,
    tokenId: result.id as number,
    scopes: parseScopes(result.scopes as string),
  };
}

export async function countUserTokens(db: D1Database, userId: number): Promise<number> {
  const result = await db.prepare(
    `SELECT COUNT(*) AS count FROM user_tokens WHERE user_id = ?`
  ).bind(userId).first();
  return (result?.count as number) ?? 0;
}

export async function listUserTokens(db: D1Database, userId: number): Promise<UserToken[]> {
  const results = await db.prepare(
    `SELECT id, user_id, name, scopes, expires_at, created_at, last_used_at FROM user_tokens WHERE user_id = ? ORDER BY created_at DESC`
  ).bind(userId).all();
  if (!results.results) return [];
  return results.results.map((row) => ({
    id: row.id as number,
    userId: row.user_id as number,
    name: row.name as string | null,
    scopes: parseScopes(row.scopes as string),
    expiresAt: row.expires_at as number,
    createdAt: row.created_at as number,
    lastUsedAt: (row.last_used_at as number | null) ?? null,
  }));
}

export async function createUserToken(
  db: D1Database,
  userId: number,
  params: CreateUserTokenParams
): Promise<UserTokenCreated> {
  const token = generateApiToken();
  const tokenHash = await hashToken(token);
  const expiresAt = Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000;
  const scopesJson = JSON.stringify(params.scopes);

  const result = await db.prepare(
    `INSERT INTO user_tokens (user_id, token_hash, name, scopes, expires_at)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id, user_id, name, scopes, expires_at, created_at, last_used_at`
  ).bind(userId, tokenHash, params.name ?? null, scopesJson, expiresAt).first();

  return {
    id: result!.id as number,
    userId: result!.user_id as number,
    name: result!.name as string | null,
    scopes: parseScopes(result!.scopes as string),
    expiresAt: result!.expires_at as number,
    createdAt: result!.created_at as number,
    lastUsedAt: (result!.last_used_at as number | null) ?? null,
    token,
  };
}

export async function deleteUserToken(db: D1Database, userId: number, tokenId: number): Promise<boolean> {
  const result = await db.prepare(
    `DELETE FROM user_tokens WHERE id = ? AND user_id = ?`
  ).bind(tokenId, userId).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function countUserMailboxes(db: D1Database, userId: number): Promise<number> {
  const result = await db.prepare(
    `SELECT COUNT(*) AS count FROM mailboxes WHERE user_id = ?`
  ).bind(userId).first();
  return (result?.count as number) ?? 0;
}

export async function countEmailsReceivedForUser(db: D1Database, userId: number): Promise<number> {
  const result = await db.prepare(
    `SELECT COUNT(*) AS count FROM emails e
     INNER JOIN mailboxes m ON e.mailbox_id = m.id
     WHERE m.user_id = ?`
  ).bind(userId).first();
  return (result?.count as number) ?? 0;
}

export async function countUserExtractRules(db: D1Database, userId: number): Promise<number> {
  const result = await db.prepare(
    `SELECT COUNT(*) AS count FROM extract_rules WHERE user_id = ?`
  ).bind(userId).first();
  return (result?.count as number) ?? 0;
}

export async function getUserTokenSummary(
  db: D1Database,
  userId: number
): Promise<{ id: number; name: string | null; scopes: TokenScope[]; expiresAt: number; lastUsedAt: number | null } | null> {
  const result = await db.prepare(
    `SELECT id, name, scopes, expires_at, last_used_at FROM user_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first();
  if (!result) return null;
  return {
    id: result.id as number,
    name: result.name as string | null,
    scopes: parseScopes(result.scopes as string),
    expiresAt: result.expires_at as number,
    lastUsedAt: (result.last_used_at as number | null) ?? null,
  };
}

export async function getDailyUsage(db: D1Database, userId: number, usageDate?: string): Promise<DailyUsage> {
  const date = usageDate ?? getTodayUsageDate();
  const result = await db.prepare(
    `SELECT user_id, usage_date, send_count, lease_count FROM daily_usage WHERE user_id = ? AND usage_date = ?`
  ).bind(userId, date).first();

  if (result) {
    return {
      userId: result.user_id as number,
      usageDate: result.usage_date as string,
      sendCount: result.send_count as number,
      leaseCount: result.lease_count as number,
    };
  }

  return { userId, usageDate: date, sendCount: 0, leaseCount: 0 };
}

export async function checkSendQuota(db: D1Database, userId: number, quota: number): Promise<{ ok: true } | { ok: false; error: string }> {
  if (quota < 0) return { ok: true };
  const usage = await getDailyUsage(db, userId);
  if (usage.sendCount >= quota) {
    return { ok: false, error: `已达到每日发信配额 (${quota})` };
  }
  return { ok: true };
}

export async function incrementSendUsage(db: D1Database, userId: number): Promise<void> {
  const date = getTodayUsageDate();
  await db.prepare(
    `INSERT INTO daily_usage (user_id, usage_date, send_count, lease_count) VALUES (?, ?, 1, 0)
     ON CONFLICT(user_id, usage_date) DO UPDATE SET send_count = send_count + 1`
  ).bind(userId, date).run();
}

export async function incrementLeaseUsage(db: D1Database, userId: number): Promise<void> {
  const date = getTodayUsageDate();
  await db.prepare(
    `INSERT INTO daily_usage (user_id, usage_date, send_count, lease_count) VALUES (?, ?, 0, 1)
     ON CONFLICT(user_id, usage_date) DO UPDATE SET lease_count = lease_count + 1`
  ).bind(userId, date).run();
}

export async function isMailboxOwnedByUser(
  db: D1Database,
  localPart: string,
  userId: number
): Promise<boolean> {
  const now = getCurrentTimestamp();
  const result = await db.prepare(
    `SELECT id FROM mailboxes WHERE address = ? AND user_id = ? AND expires_at > ?`
  ).bind(localPart, userId, now).first();
  return !!result;
}

// ─── Announcements ───────────────────────────────────────────

function mapAnnouncementRow(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as number,
    title: row.title as string,
    content: row.content as string,
    createdAt: row.created_at as number,
    updatedAt: (row.updated_at as number | null) ?? null,
    enabled: !!row.enabled,
    createdBy: (row.created_by as string | null) ?? null,
    readCount: row.read_count !== undefined ? (row.read_count as number) : undefined,
  };
}

export async function listAnnouncements(db: D1Database): Promise<Announcement[]> {
  const results = await db.prepare(
    `SELECT a.id, a.title, a.content, a.created_at, a.updated_at, a.enabled, a.created_by,
            COUNT(ar.user_id) AS read_count
     FROM announcements a
     LEFT JOIN announcement_reads ar ON ar.announcement_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC`
  ).all();
  if (!results.results) return [];
  return results.results.map((row) => mapAnnouncementRow(row as Record<string, unknown>));
}

export async function getAnnouncementById(db: D1Database, id: number): Promise<Announcement | null> {
  const result = await db.prepare(
    `SELECT id, title, content, created_at, updated_at, enabled, created_by FROM announcements WHERE id = ?`
  ).bind(id).first();
  return result ? mapAnnouncementRow(result as Record<string, unknown>) : null;
}

export async function createAnnouncement(db: D1Database, params: SaveAnnouncementParams): Promise<Announcement> {
  const now = getCurrentTimestamp();
  const result = await db.prepare(
    `INSERT INTO announcements (title, content, created_at, enabled, created_by)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id, title, content, created_at, updated_at, enabled, created_by`
  ).bind(
    params.title,
    params.content,
    now,
    params.enabled !== false ? 1 : 0,
    params.createdBy ?? null
  ).first();
  return mapAnnouncementRow(result as Record<string, unknown>);
}

export async function updateAnnouncement(
  db: D1Database,
  id: number,
  params: SaveAnnouncementParams
): Promise<Announcement | null> {
  const existing = await getAnnouncementById(db, id);
  if (!existing) return null;
  const now = getCurrentTimestamp();
  await db.prepare(
    `UPDATE announcements SET title = ?, content = ?, enabled = ?, updated_at = ? WHERE id = ?`
  ).bind(
    params.title,
    params.content,
    params.enabled !== false ? 1 : 0,
    now,
    id
  ).run();
  return getAnnouncementById(db, id);
}

export async function deleteAnnouncement(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function listUnreadAnnouncementsForUser(db: D1Database, userId: number): Promise<Announcement[]> {
  const results = await db.prepare(
    `SELECT a.id, a.title, a.content, a.created_at, a.updated_at, a.enabled, a.created_by
     FROM announcements a
     WHERE a.enabled = 1
       AND a.id NOT IN (
         SELECT announcement_id FROM announcement_reads WHERE user_id = ?
       )
     ORDER BY a.created_at ASC`
  ).bind(userId).all();
  if (!results.results) return [];
  return results.results.map((row) => mapAnnouncementRow(row as Record<string, unknown>));
}

export async function markAnnouncementRead(
  db: D1Database,
  userId: number,
  announcementId: number
): Promise<boolean> {
  const announcement = await getAnnouncementById(db, announcementId);
  if (!announcement || !announcement.enabled) return false;
  const now = getCurrentTimestamp();
  await db.prepare(
    `INSERT OR IGNORE INTO announcement_reads (user_id, announcement_id, read_at) VALUES (?, ?, ?)`
  ).bind(userId, announcementId, now).run();
  return true;
}

export async function markAllAnnouncementsRead(db: D1Database, userId: number): Promise<number> {
  const unread = await listUnreadAnnouncementsForUser(db, userId);
  if (unread.length === 0) return 0;
  const now = getCurrentTimestamp();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO announcement_reads (user_id, announcement_id, read_at) VALUES (?, ?, ?)`
  );
  for (const item of unread) {
    await stmt.bind(userId, item.id, now).run();
  }
  return unread.length;
}

// ─── Rate limit hit monitoring ───────────────────────────────

const RATE_LIMIT_HIT_RETENTION_SEC = 7 * 86400;

export async function recordRateLimitHit(
  db: D1Database,
  params: { ip: string; userId?: number | null; path: string; hitAt?: number }
): Promise<void> {
  const hitAt = params.hitAt ?? getCurrentTimestamp();
  await db
    .prepare(`INSERT INTO rate_limit_hits (ip, user_id, path, hit_at) VALUES (?, ?, ?, ?)`)
    .bind(params.ip, params.userId ?? null, params.path, hitAt)
    .run();
  const cutoff = hitAt - RATE_LIMIT_HIT_RETENTION_SEC;
  await db.prepare(`DELETE FROM rate_limit_hits WHERE hit_at < ?`).bind(cutoff).run();
}

export async function getRateLimitStats(db: D1Database): Promise<RateLimitStats> {
  const now = getCurrentTimestamp();
  const startOfDay = now - (now % 86400);

  const todayRow = await db
    .prepare(`SELECT COUNT(*) as count FROM rate_limit_hits WHERE hit_at >= ?`)
    .bind(startOfDay)
    .first<{ count: number }>();

  const topIpsResult = await db
    .prepare(
      `SELECT ip, COUNT(*) as count FROM rate_limit_hits WHERE hit_at >= ?
       GROUP BY ip ORDER BY count DESC LIMIT 10`
    )
    .bind(startOfDay)
    .all();

  const topUsersResult = await db
    .prepare(
      `SELECT h.user_id, u.username, COUNT(*) as count
       FROM rate_limit_hits h
       INNER JOIN users u ON u.id = h.user_id
       WHERE h.hit_at >= ? AND h.user_id IS NOT NULL
       GROUP BY h.user_id
       ORDER BY count DESC
       LIMIT 10`
    )
    .bind(startOfDay)
    .all();

  return {
    todayCount: todayRow?.count ?? 0,
    topIps: (topIpsResult.results ?? []).map((row) => ({
      ip: row.ip as string,
      count: row.count as number,
    })),
    topUsers: (topUsersResult.results ?? []).map((row) => ({
      userId: row.user_id as number,
      username: row.username as string,
      count: row.count as number,
    })),
  };
}

// ─── API request stats (all status codes) ───────────────────

export const API_REQUEST_STATS_RETENTION_DAYS = 7;

export async function recordApiRequestStat(
  db: D1Database,
  params: { statusCode: number; path: string; recordedAt?: number }
): Promise<void> {
  const pathGroup = normalizeApiPath(params.path);
  if (!pathGroup) return;

  const recordedAt = params.recordedAt ?? getCurrentTimestamp();
  const statDate = statDateFromTimestamp(recordedAt);

  await db
    .prepare(
      `INSERT INTO api_request_stats (stat_date, status_code, path_group, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(stat_date, status_code, path_group) DO UPDATE SET count = count + 1`
    )
    .bind(statDate, params.statusCode, pathGroup)
    .run();
}

export async function cleanupOldApiRequestStats(db: D1Database, now = getCurrentTimestamp()): Promise<number> {
  const cutoffDate = statDateFromTimestamp(now - API_REQUEST_STATS_RETENTION_DAYS * 86400);
  const result = await db
    .prepare(`DELETE FROM api_request_stats WHERE stat_date < ?`)
    .bind(cutoffDate)
    .run();
  return result.meta.changes ?? 0;
}

export async function getApiRequestStats(db: D1Database): Promise<ApiRequestStats> {
  const now = getCurrentTimestamp();
  const statDate = statDateFromTimestamp(now);
  const trendDates = lastStatDates(REQUEST_STATS_TREND_DAYS, now);
  const trendStartDate = trendDates[0];

  const statusRows = await db
    .prepare(
      `SELECT status_code, SUM(count) as count
       FROM api_request_stats
       WHERE stat_date = ?
       GROUP BY status_code`
    )
    .bind(statDate)
    .all<{ status_code: number; count: number }>();

  const pathRows = await db
    .prepare(
      `SELECT path_group, SUM(count) as count
       FROM api_request_stats
       WHERE stat_date = ?
       GROUP BY path_group`
    )
    .bind(statDate)
    .all<{ path_group: string; count: number }>();

  const trendRows = await db
    .prepare(
      `SELECT stat_date, status_code, SUM(count) as count
       FROM api_request_stats
       WHERE stat_date >= ?
       GROUP BY stat_date, status_code`
    )
    .bind(trendStartDate)
    .all<{ stat_date: string; status_code: number; count: number }>();

  const byStatusCode = aggregateByStatusCode(
    (statusRows.results ?? []).map((row) => ({
      statusCode: row.status_code,
      count: row.count,
    }))
  );
  const topPaths = aggregateTopPaths(
    (pathRows.results ?? []).map((row) => ({
      pathGroup: row.path_group,
      count: row.count,
    }))
  );
  const byCategory = categorizeStatusTotals(byStatusCode);
  const totalRequests = byStatusCode.reduce((sum, row) => sum + row.count, 0);
  const trend = buildRequestStatsTrend(
    trendDates,
    (trendRows.results ?? []).map((row) => ({
      statDate: row.stat_date,
      statusCode: row.status_code,
      count: row.count,
    }))
  );

  return {
    statDate,
    totalRequests,
    byStatusCode,
    byCategory,
    topPaths,
    trend,
  };
}

// ─── System settings & maintenance mode ──────────────────────

const MAINTENANCE_MODE_KEY = 'maintenance_mode';
const LEGACY_SEND_DAILY_QUOTA_KEY = 'legacy_send_daily_quota';

export async function getLegacySendDailyQuota(db: D1Database): Promise<number> {
  const raw = await getSystemSetting(db, LEGACY_SEND_DAILY_QUOTA_KEY);
  if (raw == null) return DEFAULT_LEGACY_SEND_DAILY_QUOTA;
  const parsed = parseInt(raw, 10);
  if (parsed < 0) return -1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LEGACY_SEND_DAILY_QUOTA;
}

export async function setLegacySendDailyQuota(db: D1Database, quota: number): Promise<number> {
  const normalized =
    quota < 0 ? -1 : Number.isFinite(quota) && quota > 0 ? Math.floor(quota) : DEFAULT_LEGACY_SEND_DAILY_QUOTA;
  await setSystemSetting(db, LEGACY_SEND_DAILY_QUOTA_KEY, String(normalized));
  return normalized;
}

function parseMaintenanceMode(raw: string | null | undefined): MaintenanceMode {
  if (!raw) return { ...DEFAULT_MAINTENANCE_MODE };
  try {
    const parsed = JSON.parse(raw) as Partial<MaintenanceMode>;
    return {
      enabled: !!parsed.enabled,
      message: typeof parsed.message === 'string' ? parsed.message : '',
      blockLease: parsed.blockLease !== false,
      blockSend: parsed.blockSend !== false,
      blockMailboxCreate: parsed.blockMailboxCreate !== false,
    };
  } catch {
    return { ...DEFAULT_MAINTENANCE_MODE };
  }
}

export async function getSystemSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM system_settings WHERE key = ?`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSystemSetting(db: D1Database, key: string, value: string): Promise<void> {
  const now = getCurrentTimestamp();
  await db
    .prepare(
      `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, value, now)
    .run();
}

export async function getMaintenanceMode(db: D1Database): Promise<MaintenanceMode> {
  const raw = await getSystemSetting(db, MAINTENANCE_MODE_KEY);
  return parseMaintenanceMode(raw);
}

export async function setMaintenanceMode(db: D1Database, mode: MaintenanceMode): Promise<MaintenanceMode> {
  const normalized: MaintenanceMode = {
    enabled: !!mode.enabled,
    message: mode.message ?? '',
    blockLease: !!mode.blockLease,
    blockSend: !!mode.blockSend,
    blockMailboxCreate: !!mode.blockMailboxCreate,
  };
  await setSystemSetting(db, MAINTENANCE_MODE_KEY, JSON.stringify(normalized));
  return normalized;
}

const REGISTRATION_SETTINGS_KEY = 'registration_settings';
const TURNSTILE_SETTINGS_KEY = 'turnstile_settings';

function parseRegistrationSettings(raw: string | null | undefined): RegistrationSettings {
  if (!raw) return { ...DEFAULT_REGISTRATION_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<RegistrationSettings & { turnstileSiteKey?: string }>;
    return { enabled: !!parsed.enabled };
  } catch {
    return { ...DEFAULT_REGISTRATION_SETTINGS };
  }
}

function parseTurnstileSettings(raw: string | null | undefined): TurnstileSettings {
  if (!raw) return { ...DEFAULT_TURNSTILE_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<TurnstileSettings & { turnstileSiteKey?: string; turnstileSecretKey?: string }>;
    return {
      siteKey: String(parsed.siteKey ?? parsed.turnstileSiteKey ?? '').trim(),
      secretKey: String(parsed.secretKey ?? parsed.turnstileSecretKey ?? '').trim(),
    };
  } catch {
    return { ...DEFAULT_TURNSTILE_SETTINGS };
  }
}

export function toAdminRegistrationView(settings: RegistrationSettings): RegistrationSettingsAdminView {
  return { enabled: settings.enabled };
}

export function toAdminTurnstileView(settings: TurnstileSettings): TurnstileSettingsAdminView {
  return {
    siteKey: settings.siteKey ?? '',
    hasSecret: !!(settings.secretKey?.trim()),
  };
}

export async function getRegistrationSettings(db: D1Database): Promise<RegistrationSettings> {
  const raw = await getSystemSetting(db, REGISTRATION_SETTINGS_KEY);
  return parseRegistrationSettings(raw);
}

export async function setRegistrationSettings(
  db: D1Database,
  settings: { enabled: boolean }
): Promise<RegistrationSettings> {
  const normalized: RegistrationSettings = { enabled: !!settings.enabled };
  await setSystemSetting(db, REGISTRATION_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

async function migrateTurnstileFromRegistration(db: D1Database): Promise<TurnstileSettings | null> {
  const regRaw = await getSystemSetting(db, REGISTRATION_SETTINGS_KEY);
  if (!regRaw) return null;
  try {
    const parsed = JSON.parse(regRaw) as {
      turnstileSiteKey?: string;
      turnstileSecretKey?: string;
    };
    const siteKey = String(parsed.turnstileSiteKey ?? '').trim();
    const secretKey = String(parsed.turnstileSecretKey ?? '').trim();
    if (!siteKey && !secretKey) return null;
    const migrated: TurnstileSettings = { siteKey, secretKey };
    await setSystemSetting(db, TURNSTILE_SETTINGS_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return null;
  }
}

export async function getTurnstileSettings(db: D1Database): Promise<TurnstileSettings> {
  const raw = await getSystemSetting(db, TURNSTILE_SETTINGS_KEY);
  if (raw) return parseTurnstileSettings(raw);
  const migrated = await migrateTurnstileFromRegistration(db);
  return migrated ?? { ...DEFAULT_TURNSTILE_SETTINGS };
}

export async function setTurnstileSettings(
  db: D1Database,
  settings: { siteKey?: string; secretKey?: string }
): Promise<TurnstileSettings> {
  const existing = await getTurnstileSettings(db);
  let siteKey = existing.siteKey ?? '';
  let secretKey = existing.secretKey ?? '';

  if (settings.siteKey !== undefined) {
    siteKey = String(settings.siteKey).trim();
  }
  if (settings.secretKey !== undefined && String(settings.secretKey).trim() !== '') {
    secretKey = String(settings.secretKey).trim();
  }

  const normalized: TurnstileSettings = { siteKey, secretKey };
  await setSystemSetting(db, TURNSTILE_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

function mapRegistrationVerification(row: Record<string, unknown>): RegistrationVerificationRow {
  return {
    id: row.id as number,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    codeHash: row.code_hash as string,
    expiresAt: row.expires_at as number,
    createdAt: row.created_at as number,
    ip: (row.ip as string | null) ?? null,
    attempts: (row.attempts as number) ?? 0,
  };
}

export async function deleteRegistrationVerificationByEmail(db: D1Database, email: string): Promise<void> {
  await db.prepare(`DELETE FROM registration_verifications WHERE email = ?`).bind(email).run();
}

export async function createRegistrationVerification(
  db: D1Database,
  params: {
    email: string;
    passwordHash: string;
    codeHash: string;
    expiresAt: number;
    ip: string | null;
  }
): Promise<RegistrationVerificationRow> {
  const now = getCurrentTimestamp();
  await deleteRegistrationVerificationByEmail(db, params.email);
  const result = await db
    .prepare(
      `INSERT INTO registration_verifications (email, password_hash, code_hash, expires_at, created_at, ip, attempts)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       RETURNING id, email, password_hash, code_hash, expires_at, created_at, ip, attempts`
    )
    .bind(
      params.email,
      params.passwordHash,
      params.codeHash,
      params.expiresAt,
      now,
      params.ip
    )
    .first();
  return mapRegistrationVerification(result as Record<string, unknown>);
}

export async function getRegistrationVerificationByEmail(
  db: D1Database,
  email: string
): Promise<RegistrationVerificationRow | null> {
  const result = await db
    .prepare(
      `SELECT id, email, password_hash, code_hash, expires_at, created_at, ip, attempts
       FROM registration_verifications WHERE email = ?`
    )
    .bind(email)
    .first();
  return result ? mapRegistrationVerification(result as Record<string, unknown>) : null;
}

export async function incrementRegistrationVerificationAttempts(
  db: D1Database,
  id: number
): Promise<void> {
  await db
    .prepare(`UPDATE registration_verifications SET attempts = attempts + 1 WHERE id = ?`)
    .bind(id)
    .run();
}

export async function deleteRegistrationVerification(db: D1Database, id: number): Promise<void> {
  await db.prepare(`DELETE FROM registration_verifications WHERE id = ?`).bind(id).run();
}

// ─── Password reset verifications ────────────────────────────

export async function deletePasswordResetVerificationByEmail(db: D1Database, email: string): Promise<void> {
  await db.prepare(`DELETE FROM password_reset_verifications WHERE email = ?`).bind(email).run();
}

export async function createPasswordResetVerification(
  db: D1Database,
  params: {
    email: string;
    passwordHash: string;
    codeHash: string;
    expiresAt: number;
    ip: string | null;
  }
): Promise<RegistrationVerificationRow> {
  const now = getCurrentTimestamp();
  await deletePasswordResetVerificationByEmail(db, params.email);
  const result = await db
    .prepare(
      `INSERT INTO password_reset_verifications (email, password_hash, code_hash, expires_at, created_at, ip, attempts)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       RETURNING id, email, password_hash, code_hash, expires_at, created_at, ip, attempts`
    )
    .bind(params.email, params.passwordHash, params.codeHash, params.expiresAt, now, params.ip)
    .first();
  return mapRegistrationVerification(result as Record<string, unknown>);
}

export async function getPasswordResetVerificationByEmail(
  db: D1Database,
  email: string
): Promise<RegistrationVerificationRow | null> {
  const result = await db
    .prepare(
      `SELECT id, email, password_hash, code_hash, expires_at, created_at, ip, attempts
       FROM password_reset_verifications WHERE email = ?`
    )
    .bind(email)
    .first();
  return result ? mapRegistrationVerification(result as Record<string, unknown>) : null;
}

export async function incrementPasswordResetVerificationAttempts(db: D1Database, id: number): Promise<void> {
  await db
    .prepare(`UPDATE password_reset_verifications SET attempts = attempts + 1 WHERE id = ?`)
    .bind(id)
    .run();
}

export async function deletePasswordResetVerification(db: D1Database, id: number): Promise<void> {
  await db.prepare(`DELETE FROM password_reset_verifications WHERE id = ?`).bind(id).run();
}

// ─── Local email / Brevo dashboard stats ───────────────────

export async function getLocalEmailStats(db: D1Database): Promise<LocalEmailStats> {
  const now = getCurrentTimestamp();
  const startOfDay = now - (now % 86400);

  const [sentToday, failedToday, failedTotal, userQuotaSum] = await Promise.all([
    db
      .prepare(`SELECT COUNT(*) as count FROM sent_emails WHERE created_at >= ?`)
      .bind(startOfDay)
      .first<{ count: number }>(),
    db
      .prepare(`SELECT COUNT(*) as count FROM sent_emails WHERE created_at >= ? AND status != 'sent'`)
      .bind(startOfDay)
      .first<{ count: number }>(),
    db
      .prepare(`SELECT COUNT(*) as count FROM sent_emails WHERE status != 'sent'`)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN daily_send_quota >= 0 THEN daily_send_quota ELSE 0 END), 0) as total
         FROM users WHERE enabled = 1`
      )
      .first<{ total: number }>(),
  ]);

  return {
    sentToday: sentToday?.count ?? 0,
    failedToday: failedToday?.count ?? 0,
    failedTotal: failedTotal?.count ?? 0,
    userQuotaSum: userQuotaSum?.total ?? 0,
  };
}

// ─── Audit logs ──────────────────────────────────────────────

function mapAuditLogRow(row: Record<string, unknown>): AuditLog {
  let detail: Record<string, unknown> | null = null;
  const rawDetail = row.detail as string | null | undefined;
  if (rawDetail) {
    try {
      detail = JSON.parse(rawDetail) as Record<string, unknown>;
    } catch {
      detail = { raw: rawDetail };
    }
  }
  return {
    id: row.id as number,
    actorType: row.actor_type as AuditLog['actorType'],
    actorId: (row.actor_id as string | null) ?? null,
    actorName: (row.actor_name as string | null) ?? null,
    action: row.action as string,
    detail,
    ip: (row.ip as string | null) ?? null,
    createdAt: row.created_at as number,
  };
}

export async function writeAuditLog(db: D1Database, params: WriteAuditLogParams): Promise<void> {
  const detailJson =
    params.detail != null && Object.keys(params.detail).length > 0
      ? JSON.stringify(params.detail)
      : null;
  await db
    .prepare(
      `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, detail, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.actorType,
      params.actorId != null ? String(params.actorId) : null,
      params.actorName ?? null,
      params.action,
      detailJson,
      params.ip ?? null,
      getCurrentTimestamp()
    )
    .run();
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  from?: number;
  to?: number;
}

export async function listAuditLogs(
  db: D1Database,
  params: ListAuditLogsParams = {}
): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const binds: Array<number> = [];
  if (params.from != null) {
    conditions.push('created_at >= ?');
    binds.push(params.from);
  }
  if (params.to != null) {
    conditions.push('created_at <= ?');
    binds.push(params.to);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await db
    .prepare(`SELECT COUNT(*) as count FROM audit_logs ${where}`)
    .bind(...binds)
    .first<{ count: number }>();

  const results = await db
    .prepare(
      `SELECT id, actor_type, actor_id, actor_name, action, detail, ip, created_at
       FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all();

  return {
    logs: (results.results ?? []).map((row) => mapAuditLogRow(row as Record<string, unknown>)),
    total: countRow?.count ?? 0,
    page,
    limit,
  };
}

// ─── Mail domains ────────────────────────────────────────────

function mapMailDomainRow(row: Record<string, unknown>): MailDomain {
  return {
    id: row.id as number,
    domain: row.domain as string,
    enabled: !!(row.enabled as number),
    isDefault: !!(row.is_default as number),
    cloudflareReady: !!(row.cloudflare_ready as number),
    brevoVerified: !!(row.brevo_verified as number),
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export async function countMailDomains(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) as c FROM mail_domains`).first<{ c: number }>();
  return row?.c ?? 0;
}

export async function listMailDomains(db: D1Database): Promise<MailDomain[]> {
  const results = await db
    .prepare(
      `SELECT id, domain, enabled, is_default, cloudflare_ready, brevo_verified, sort_order, created_at, updated_at
       FROM mail_domains
       ORDER BY sort_order ASC, id ASC`
    )
    .all();
  return (results.results ?? []).map((row) => mapMailDomainRow(row as Record<string, unknown>));
}

export async function getMailDomainById(db: D1Database, id: number): Promise<MailDomain | null> {
  const row = await db
    .prepare(
      `SELECT id, domain, enabled, is_default, cloudflare_ready, brevo_verified, sort_order, created_at, updated_at
       FROM mail_domains WHERE id = ?`
    )
    .bind(id)
    .first();
  return row ? mapMailDomainRow(row as Record<string, unknown>) : null;
}

export async function getEnabledMailDomainNames(db: D1Database): Promise<string[]> {
  const results = await db
    .prepare(
      `SELECT domain FROM mail_domains WHERE enabled = 1 ORDER BY is_default DESC, sort_order ASC, id ASC`
    )
    .all();
  return (results.results ?? []).map((row) => (row as { domain: string }).domain);
}

async function clearDefaultMailDomain(db: D1Database, exceptId?: number): Promise<void> {
  const now = getCurrentTimestamp();
  if (exceptId != null) {
    await db
      .prepare(`UPDATE mail_domains SET is_default = 0, updated_at = ? WHERE id != ?`)
      .bind(now, exceptId)
      .run();
  } else {
    await db.prepare(`UPDATE mail_domains SET is_default = 0, updated_at = ?`).bind(now).run();
  }
}

export async function seedMailDomainsFromEnvIfEmpty(
  db: D1Database,
  rawDomains: string | undefined
): Promise<void> {
  const count = await countMailDomains(db);
  if (count > 0) return;

  const domains = (rawDomains || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (!domains.length) return;

  const now = getCurrentTimestamp();
  for (let i = 0; i < domains.length; i++) {
    await db
      .prepare(
        `INSERT INTO mail_domains (domain, enabled, is_default, cloudflare_ready, brevo_verified, sort_order, created_at, updated_at)
         VALUES (?, 1, ?, 0, 0, ?, ?, ?)`
      )
      .bind(domains[i], i === 0 ? 1 : 0, i, now, now)
      .run();
  }
  console.log(`已从环境变量导入 ${domains.length} 个邮箱域名`);
}

export async function createMailDomain(
  db: D1Database,
  params: CreateMailDomainParams
): Promise<MailDomain> {
  const now = getCurrentTimestamp();
  const domain = params.domain.trim().toLowerCase();
  const enabled = params.enabled !== false;
  const isDefault = !!params.isDefault;
  const count = await countMailDomains(db);
  const sortOrder = count;

  if (isDefault || count === 0) {
    await clearDefaultMailDomain(db);
  }

  const result = await db
    .prepare(
      `INSERT INTO mail_domains (domain, enabled, is_default, cloudflare_ready, brevo_verified, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      domain,
      enabled ? 1 : 0,
      isDefault || count === 0 ? 1 : 0,
      params.cloudflareReady ? 1 : 0,
      params.brevoVerified ? 1 : 0,
      sortOrder,
      now,
      now
    )
    .run();

  const id = result.meta.last_row_id as number;
  const created = await getMailDomainById(db, id);
  if (!created) throw new Error('创建域名记录失败');
  return created;
}

export async function updateMailDomain(
  db: D1Database,
  id: number,
  params: UpdateMailDomainParams
): Promise<MailDomain | null> {
  const existing = await getMailDomainById(db, id);
  if (!existing) return null;

  const now = getCurrentTimestamp();
  const enabled = params.enabled !== undefined ? !!params.enabled : existing.enabled;
  const isDefault = params.isDefault !== undefined ? !!params.isDefault : existing.isDefault;
  const cloudflareReady =
    params.cloudflareReady !== undefined ? !!params.cloudflareReady : existing.cloudflareReady;
  const brevoVerified =
    params.brevoVerified !== undefined ? !!params.brevoVerified : existing.brevoVerified;
  const sortOrder = params.sortOrder !== undefined ? params.sortOrder : existing.sortOrder;

  if (isDefault && !enabled) {
    throw new Error('默认域名不能处于禁用状态');
  }

  if (enabled && (!cloudflareReady || !brevoVerified)) {
    throw new Error('启用域名前须确认 Cloudflare 与 Brevo 均已配置完成');
  }

  if (isDefault) {
    await clearDefaultMailDomain(db, id);
  }

  await db
    .prepare(
      `UPDATE mail_domains
       SET enabled = ?, is_default = ?, cloudflare_ready = ?, brevo_verified = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(enabled ? 1 : 0, isDefault ? 1 : 0, cloudflareReady ? 1 : 0, brevoVerified ? 1 : 0, sortOrder, now, id)
    .run();

  return getMailDomainById(db, id);
}

export async function deleteMailDomain(db: D1Database, id: number): Promise<boolean> {
  const existing = await getMailDomainById(db, id);
  if (!existing) return false;

  const enabledCount = await db
    .prepare(`SELECT COUNT(*) as c FROM mail_domains WHERE enabled = 1`)
    .first<{ c: number }>();
  if (existing.enabled && (enabledCount?.c ?? 0) <= 1) {
    throw new Error('至少保留一个已启用的域名');
  }

  await db.prepare(`DELETE FROM mail_domains WHERE id = ?`).bind(id).run();

  if (existing.isDefault) {
    const next = await db
      .prepare(`SELECT id FROM mail_domains WHERE enabled = 1 ORDER BY sort_order ASC, id ASC LIMIT 1`)
      .first<{ id: number }>();
    if (next) {
      await updateMailDomain(db, next.id, { isDefault: true });
    }
  }

  return true;
}