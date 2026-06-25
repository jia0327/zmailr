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
  SaveExtractRuleParams,
  SentEmail,
  AdminStats,
  User,
  UserToken,
  UserTokenCreated,
  DailyUsage,
  CreateUserParams,
  UpdateUserParams,
  CreateUserTokenParams,
  TokenScope,
} from './types';
import { 
  generateId, 
  getCurrentTimestamp, 
  calculateExpiryTimestamp,
  generateApiToken,
} from './utils';
import { hashPassword, hashToken } from './crypto';

// 附件分块大小（字节）
const CHUNK_SIZE = 500000; // 约500KB

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
    await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', daily_send_quota INTEGER NOT NULL DEFAULT 50, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()), last_login_at INTEGER);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS user_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token_hash TEXT UNIQUE NOT NULL, name TEXT, scopes TEXT NOT NULL DEFAULT '["lease","mail","send"]', expires_at INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch()), last_used_at INTEGER, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS daily_usage (user_id INTEGER NOT NULL, usage_date TEXT NOT NULL, send_count INTEGER NOT NULL DEFAULT 0, lease_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, usage_date), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`);
    await db.exec(`CREATE TABLE IF NOT EXISTS api_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, window_start INTEGER NOT NULL);`);

    // Phase 2: add columns to existing tables (must run before indexes on those columns)
    await migrateAddColumn(db, 'emails', 'extracted_code', 'TEXT');
    await migrateAddColumn(db, 'emails', 'raw_content', 'TEXT');
    await migrateAddColumn(db, 'mailboxes', 'last_api_mail_email_id', 'TEXT');
    await migrateAddColumn(db, 'mailboxes', 'last_api_mail_received_at', 'INTEGER');
    await migrateAddColumn(db, 'mailboxes', 'user_id', 'INTEGER');
    await migrateAddColumn(db, 'sent_emails', 'user_id', 'INTEGER');
    await migrateAddColumn(db, 'sent_emails', 'token_id', 'INTEGER');
    await migrateAddColumn(db, 'extract_rules', 'user_id', 'INTEGER');

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

    await seedAdminUser(db, adminPassword);
    
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

export function getTodayUsageDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    username: row.username as string,
    role: row.role as User['role'],
    dailySendQuota: row.daily_send_quota as number,
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
  };
  
  await db.prepare(`INSERT INTO mailboxes (id, address, created_at, expires_at, ip_address, last_accessed, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(mailbox.id, mailbox.address, mailbox.createdAt, mailbox.expiresAt, mailbox.ipAddress, mailbox.lastAccessed, params.userId ?? null).run();
  
  return mailbox;
}

/**
 * 获取邮箱信息
 * @param db 数据库实例
 * @param address 邮箱地址
 * @returns 邮箱信息
 */
export async function getMailbox(db: D1Database, address: string): Promise<Mailbox | null> {
  const now = getCurrentTimestamp();
  const result = await db.prepare(`SELECT id, address, created_at, expires_at, ip_address, last_accessed, user_id FROM mailboxes WHERE address = ? AND expires_at > ?`).bind(address, now).first();
  
  if (!result) return null;
  
  // 更新最后访问时间
  await db.prepare(`UPDATE mailboxes SET last_accessed = ? WHERE id = ?`).bind(now, result.id).run();
  
  return {
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: now,
    userId: (result.user_id as number | null) ?? null,
  };
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
  };
}

export async function listMailboxesByUser(
  db: D1Database,
  userId: number,
  limit = 50
): Promise<Mailbox[]> {
  const now = getCurrentTimestamp();
  const results = await db
    .prepare(
      `SELECT id, address, created_at, expires_at, ip_address, last_accessed
       FROM mailboxes WHERE user_id = ? AND expires_at > ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .bind(userId, now, limit)
    .all();
  if (!results.results) return [];
  return results.results.map((row) => mapMailboxRow(row as Record<string, unknown>));
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
      rawContent: params.rawContent ?? null,
    };
    
    console.log('准备插入邮件:', email.id);
    
    await db.prepare(`INSERT INTO emails (id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read, extracted_code, raw_content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(email.id, email.mailboxId, email.fromAddress, email.fromName, email.toAddress, email.subject, email.textContent, email.htmlContent, email.receivedAt, email.hasAttachments ? 1 : 0, email.isRead ? 1 : 0, email.extractedCode, email.rawContent).run();
    
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
export async function saveAttachment(db: D1Database, params: SaveAttachmentParams): Promise<Attachment> {
  try {
    console.log('开始保存附件...');
    
    const now = getCurrentTimestamp();
    const attachmentId = generateId();
    
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

/**
 * 获取邮件列表
 * @param db 数据库实例
 * @param mailboxId 邮箱ID
 * @returns 邮件列表
 */
export async function getEmails(db: D1Database, mailboxId: string): Promise<EmailListItem[]> {
  const results = await db.prepare(`SELECT id, mailbox_id, from_address, from_name, to_address, subject, received_at, has_attachments, is_read, extracted_code FROM emails WHERE mailbox_id = ? ORDER BY received_at DESC`).bind(mailboxId).all();
  
  if (!results.results) return [];
  
  return results.results.map(result => ({
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
  }));
}

/**
 * 获取邮件详情
 * @param db 数据库实例
 * @param id 邮件ID
 * @returns 邮件详情
 */
export async function getEmail(db: D1Database, id: string): Promise<Email | null> {
  const result = await db.prepare(`SELECT id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read, extracted_code, raw_content FROM emails WHERE id = ?`).bind(id).first();
  
  if (!result) return null;
  
  // 标记为已读
  await db.prepare(`UPDATE emails SET is_read = 1 WHERE id = ?`).bind(id).run();
  
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
    isRead: true,
    extractedCode: (result.extracted_code as string | null) ?? null,
    rawContent: (result.raw_content as string | null) ?? null,
  };
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
  const result = await db.prepare(`SELECT id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count FROM attachments WHERE id = ?`).bind(id).first();
  
  if (!result) return null;
  
  const isLarge = !!result.is_large;
  let content = result.content as string;
  
  // 如果是大型附件，需要从块表中获取内容
  if (isLarge) {
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
    chunksCount: result.chunks_count as number
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

// ─── API Token ───────────────────────────────────────────────

export async function verifyApiToken(db: D1Database, token: string): Promise<boolean> {
  const nowMs = Date.now();
  const result = await db.prepare(
    `SELECT id FROM api_tokens WHERE token = ? AND expires_at > ?`
  ).bind(token, nowMs).first();
  return !!result;
}

export async function listApiTokens(db: D1Database): Promise<ApiToken[]> {
  const results = await db.prepare(
    `SELECT id, token, name, expires_at, created_at FROM api_tokens ORDER BY created_at DESC`
  ).all();
  if (!results.results) return [];
  return results.results.map(row => ({
    id: row.id as number,
    token: row.token as string,
    name: row.name as string | null,
    expiresAt: row.expires_at as number,
    createdAt: row.created_at as number,
  }));
}

export async function createApiToken(db: D1Database, params: CreateApiTokenParams): Promise<ApiToken> {
  const token = generateApiToken();
  const expiresAt = Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000;
  const result = await db.prepare(
    `INSERT INTO api_tokens (token, name, expires_at) VALUES (?, ?, ?) RETURNING id, token, name, expires_at, created_at`
  ).bind(token, params.name ?? null, expiresAt).first();
  return {
    id: result!.id as number,
    token: result!.token as string,
    name: result!.name as string | null,
    expiresAt: result!.expires_at as number,
    createdAt: result!.created_at as number,
  };
}

export async function deleteApiToken(db: D1Database, id: number): Promise<void> {
  await db.prepare(`DELETE FROM api_tokens WHERE id = ?`).bind(id).run();
}

// ─── Extract Rules ───────────────────────────────────────────

function mapExtractRuleRow(row: Record<string, unknown>): ExtractRule {
  return {
    id: row.id as number,
    domain: row.domain as string,
    regex: row.regex as string,
    priority: row.priority as number,
    enabled: !!row.enabled,
    createdAt: row.created_at as number,
    userId: (row.user_id as number | null) ?? null,
  };
}

export async function listExtractRules(db: D1Database): Promise<ExtractRule[]> {
  const results = await db.prepare(
    `SELECT id, domain, regex, priority, enabled, created_at, user_id FROM extract_rules
     WHERE user_id IS NULL
     ORDER BY priority DESC, id ASC`
  ).all();
  if (!results.results) return [];
  return results.results.map((row) => mapExtractRuleRow(row as Record<string, unknown>));
}

export async function listUserExtractRules(db: D1Database, userId: number): Promise<ExtractRule[]> {
  const results = await db.prepare(
    `SELECT id, domain, regex, priority, enabled, created_at, user_id FROM extract_rules
     WHERE user_id = ?
     ORDER BY priority DESC, id ASC`
  ).bind(userId).all();
  if (!results.results) return [];
  return results.results.map((row) => mapExtractRuleRow(row as Record<string, unknown>));
}

function sortExtractRulesForDomain(rules: ExtractRule[], senderDomain: string): ExtractRule[] {
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
    `SELECT id, domain, regex, priority, enabled, created_at, user_id FROM extract_rules
     WHERE enabled = 1 AND user_id IS NULL AND (domain = ? OR domain = '*')`
  ).bind(senderDomain).all();

  let userRules: ExtractRule[] = [];
  if (userId != null) {
    const userResults = await db.prepare(
      `SELECT id, domain, regex, priority, enabled, created_at, user_id FROM extract_rules
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
    `SELECT id, domain, regex, priority, enabled, created_at, user_id FROM extract_rules WHERE id = ?`
  ).bind(id).first();
  return result ? mapExtractRuleRow(result as Record<string, unknown>) : null;
}

export async function createExtractRule(db: D1Database, params: SaveExtractRuleParams): Promise<ExtractRule> {
  const result = await db.prepare(
    `INSERT INTO extract_rules (domain, regex, priority, enabled, user_id) VALUES (?, ?, ?, ?, ?)
     RETURNING id, domain, regex, priority, enabled, created_at, user_id`
  ).bind(
    params.domain || '*',
    params.regex,
    params.priority ?? 0,
    params.enabled !== false ? 1 : 0,
    params.userId ?? null
  ).first();
  return mapExtractRuleRow(result as Record<string, unknown>);
}

export async function updateExtractRule(db: D1Database, id: number, params: SaveExtractRuleParams): Promise<ExtractRule | null> {
  const existing = await getExtractRuleById(db, id);
  if (!existing) return null;
  await db.prepare(
    `UPDATE extract_rules SET domain = ?, regex = ?, priority = ?, enabled = ? WHERE id = ?`
  ).bind(
    params.domain || '*',
    params.regex,
    params.priority ?? 0,
    params.enabled !== false ? 1 : 0,
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

// ─── Sent Emails ─────────────────────────────────────────────

export async function saveSentEmail(
  db: D1Database,
  toEmail: string,
  subject: string,
  status: string = 'sent',
  userId?: number | null,
  tokenId?: number | null
): Promise<SentEmail> {
  const result = await db.prepare(
    `INSERT INTO sent_emails (to_email, subject, status, user_id, token_id) VALUES (?, ?, ?, ?, ?)
     RETURNING id, to_email, subject, status, created_at, user_id, token_id`
  ).bind(toEmail, subject, status, userId ?? null, tokenId ?? null).first();
  return {
    id: result!.id as number,
    toEmail: result!.to_email as string,
    subject: result!.subject as string,
    status: result!.status as string,
    createdAt: result!.created_at as number,
    userId: (result!.user_id as number | null) ?? null,
    tokenId: (result!.token_id as number | null) ?? null,
  };
}

export async function listSentEmails(db: D1Database, limit = 100): Promise<SentEmail[]> {
  const results = await db.prepare(
    `SELECT id, to_email, subject, status, created_at FROM sent_emails ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();
  if (!results.results) return [];
  return results.results.map(row => ({
    id: row.id as number,
    toEmail: row.to_email as string,
    subject: row.subject as string,
    status: row.status as string,
    createdAt: row.created_at as number,
  }));
}

export async function listUserSentEmails(db: D1Database, userId: number, limit = 50): Promise<SentEmail[]> {
  const results = await db.prepare(
    `SELECT id, to_email, subject, status, created_at, user_id, token_id
     FROM sent_emails WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(userId, limit).all();
  if (!results.results) return [];
  return results.results.map(row => ({
    id: row.id as number,
    toEmail: row.to_email as string,
    subject: row.subject as string,
    status: row.status as string,
    createdAt: row.created_at as number,
    userId: (row.user_id as number | null) ?? null,
    tokenId: (row.token_id as number | null) ?? null,
  }));
}

// ─── Admin Stats & Polling ───────────────────────────────────

export async function getAdminStats(db: D1Database): Promise<AdminStats> {
  const now = getCurrentTimestamp();
  const startOfDay = now - (now % 86400);

  const received = await db.prepare(
    `SELECT COUNT(*) as count FROM emails WHERE received_at >= ?`
  ).bind(startOfDay).first<{ count: number }>();

  const sent = await db.prepare(
    `SELECT COUNT(*) as count FROM sent_emails WHERE created_at >= ?`
  ).bind(startOfDay).first<{ count: number }>();

  const tokens = await db.prepare(
    `SELECT COUNT(*) as count FROM api_tokens WHERE expires_at > ?`
  ).bind(Date.now()).first<{ count: number }>();

  const rules = await db.prepare(
    `SELECT COUNT(*) as count FROM extract_rules WHERE enabled = 1`
  ).first<{ count: number }>();

  return {
    receivedToday: received?.count ?? 0,
    sentToday: sent?.count ?? 0,
    activeTokens: tokens?.count ?? 0,
    activeRules: rules?.count ?? 0,
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
    `SELECT id, username, role, daily_send_quota, enabled, created_at, last_login_at FROM users WHERE id = ?`
  ).bind(id).first();
  return result ? mapUser(result as Record<string, unknown>) : null;
}

export async function getUserByUsername(db: D1Database, username: string): Promise<User | null> {
  const result = await db.prepare(
    `SELECT id, username, role, daily_send_quota, enabled, created_at, last_login_at FROM users WHERE username = ?`
  ).bind(username).first();
  return result ? mapUser(result as Record<string, unknown>) : null;
}

export async function listUsers(db: D1Database): Promise<User[]> {
  const results = await db.prepare(
    `SELECT id, username, role, daily_send_quota, enabled, created_at, last_login_at FROM users ORDER BY created_at ASC`
  ).all();
  if (!results.results) return [];
  return results.results.map((row) => mapUser(row as Record<string, unknown>));
}

export async function createUser(db: D1Database, params: CreateUserParams): Promise<User> {
  const passwordHash = await hashPassword(params.password);
  const result = await db.prepare(
    `INSERT INTO users (username, password_hash, role, daily_send_quota, enabled)
     VALUES (?, ?, ?, ?, 1)
     RETURNING id, username, role, daily_send_quota, enabled, created_at, last_login_at`
  ).bind(
    params.username,
    passwordHash,
    params.role ?? 'user',
    params.dailySendQuota ?? 50
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
    `SELECT id, user_id, scopes FROM user_tokens WHERE token_hash = ? AND expires_at > ?`
  ).bind(tokenHash, nowMs).first();

  if (!result) return null;

  await db.prepare(`UPDATE user_tokens SET last_used_at = ? WHERE id = ?`).bind(getCurrentTimestamp(), result.id).run();

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