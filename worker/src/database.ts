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
} from './types';
import { 
  generateId, 
  getCurrentTimestamp, 
  calculateExpiryTimestamp,
  generateApiToken,
} from './utils';

// 附件分块大小（字节）
const CHUNK_SIZE = 500000; // 约500KB

/**
 * 初始化数据库
 * @param db 数据库实例
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
  try {
    // 创建邮箱表
    await db.exec(`CREATE TABLE IF NOT EXISTS mailboxes (id TEXT PRIMARY KEY, address TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ip_address TEXT, last_accessed INTEGER NOT NULL);`);
    
    // 创建邮件表
    await db.exec(`CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, mailbox_id TEXT NOT NULL, from_address TEXT NOT NULL, from_name TEXT, to_address TEXT NOT NULL, subject TEXT, text_content TEXT, html_content TEXT, received_at INTEGER NOT NULL, has_attachments BOOLEAN DEFAULT FALSE, is_read BOOLEAN DEFAULT FALSE, FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE);`);
    
    // 创建附件表
    await db.exec(`CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, email_id TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, content TEXT, size INTEGER NOT NULL, created_at INTEGER NOT NULL, is_large BOOLEAN DEFAULT FALSE, chunks_count INTEGER DEFAULT 0, FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE);`);
    
    // 创建附件块表
    await db.exec(`CREATE TABLE IF NOT EXISTS attachment_chunks (id TEXT PRIMARY KEY, attachment_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE);`);
    
    // 创建索引
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_expires_at ON mailboxes(expires_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_attachment_id ON attachment_chunks(attachment_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_chunk_index ON attachment_chunks(chunk_index);`);

    // 迁移：为 emails 表添加 extracted_code 列
    await migrateAddColumn(db, 'emails', 'extracted_code', 'TEXT');

    // 迁移：记录 /api/mail 上次成功返回的邮件，避免重复轮询返回同一封
    await migrateAddColumn(db, 'mailboxes', 'last_api_mail_email_id', 'TEXT');
    await migrateAddColumn(db, 'mailboxes', 'last_api_mail_received_at', 'INTEGER');

    // API Token 表 (D1 exec requires single-line SQL)
    await db.exec(`CREATE TABLE IF NOT EXISTS api_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, name TEXT, expires_at INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch()));`);

    // 验证码提取规则表
    await db.exec(`CREATE TABLE IF NOT EXISTS extract_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL DEFAULT '*', regex TEXT NOT NULL, priority INTEGER DEFAULT 0, enabled INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()));`);

    // 发信审计表
    await db.exec(`CREATE TABLE IF NOT EXISTS sent_emails (id INTEGER PRIMARY KEY AUTOINCREMENT, to_email TEXT NOT NULL, subject TEXT NOT NULL, status TEXT DEFAULT 'sent', created_at INTEGER DEFAULT (unixepoch()));`);

    await db.exec(`CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_extract_rules_domain ON extract_rules(domain);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_extracted_code ON emails(extracted_code);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_sent_emails_created_at ON sent_emails(created_at);`);
    
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
  
  await db.prepare(`INSERT INTO mailboxes (id, address, created_at, expires_at, ip_address, last_accessed) VALUES (?, ?, ?, ?, ?, ?)`).bind(mailbox.id, mailbox.address, mailbox.createdAt, mailbox.expiresAt, mailbox.ipAddress, mailbox.lastAccessed).run();
  
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
  const result = await db.prepare(`SELECT id, address, created_at, expires_at, ip_address, last_accessed FROM mailboxes WHERE address = ? AND expires_at > ?`).bind(address, now).first();
  
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
    };
    
    console.log('准备插入邮件:', email.id);
    
    await db.prepare(`INSERT INTO emails (id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read, extracted_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(email.id, email.mailboxId, email.fromAddress, email.fromName, email.toAddress, email.subject, email.textContent, email.htmlContent, email.receivedAt, email.hasAttachments ? 1 : 0, email.isRead ? 1 : 0, email.extractedCode).run();
    
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
  const result = await db.prepare(`SELECT id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read, extracted_code FROM emails WHERE id = ?`).bind(id).first();
  
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
  };
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

export async function listExtractRules(db: D1Database): Promise<ExtractRule[]> {
  const results = await db.prepare(
    `SELECT id, domain, regex, priority, enabled, created_at FROM extract_rules ORDER BY priority DESC, id ASC`
  ).all();
  if (!results.results) return [];
  return results.results.map(row => ({
    id: row.id as number,
    domain: row.domain as string,
    regex: row.regex as string,
    priority: row.priority as number,
    enabled: !!row.enabled,
    createdAt: row.created_at as number,
  }));
}

export async function getEnabledExtractRules(db: D1Database, senderDomain: string): Promise<ExtractRule[]> {
  const results = await db.prepare(
    `SELECT id, domain, regex, priority, enabled, created_at FROM extract_rules
     WHERE enabled = 1 AND (domain = ? OR domain = '*')
     ORDER BY CASE WHEN domain = '*' THEN 0 ELSE 1 END DESC, priority DESC, id ASC`
  ).bind(senderDomain).all();
  if (!results.results) return [];
  return results.results.map(row => ({
    id: row.id as number,
    domain: row.domain as string,
    regex: row.regex as string,
    priority: row.priority as number,
    enabled: !!row.enabled,
    createdAt: row.created_at as number,
  }));
}

export async function createExtractRule(db: D1Database, params: SaveExtractRuleParams): Promise<ExtractRule> {
  const result = await db.prepare(
    `INSERT INTO extract_rules (domain, regex, priority, enabled) VALUES (?, ?, ?, ?)
     RETURNING id, domain, regex, priority, enabled, created_at`
  ).bind(
    params.domain || '*',
    params.regex,
    params.priority ?? 0,
    params.enabled !== false ? 1 : 0
  ).first();
  return {
    id: result!.id as number,
    domain: result!.domain as string,
    regex: result!.regex as string,
    priority: result!.priority as number,
    enabled: !!result!.enabled,
    createdAt: result!.created_at as number,
  };
}

export async function updateExtractRule(db: D1Database, id: number, params: SaveExtractRuleParams): Promise<ExtractRule | null> {
  const existing = await db.prepare(`SELECT id FROM extract_rules WHERE id = ?`).bind(id).first();
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
  const result = await db.prepare(
    `SELECT id, domain, regex, priority, enabled, created_at FROM extract_rules WHERE id = ?`
  ).bind(id).first();
  if (!result) return null;
  return {
    id: result.id as number,
    domain: result.domain as string,
    regex: result.regex as string,
    priority: result.priority as number,
    enabled: !!result.enabled,
    createdAt: result.created_at as number,
  };
}

export async function deleteExtractRule(db: D1Database, id: number): Promise<void> {
  await db.prepare(`DELETE FROM extract_rules WHERE id = ?`).bind(id).run();
}

// ─── Sent Emails ─────────────────────────────────────────────

export async function saveSentEmail(
  db: D1Database,
  toEmail: string,
  subject: string,
  status: string = 'sent'
): Promise<SentEmail> {
  const result = await db.prepare(
    `INSERT INTO sent_emails (to_email, subject, status) VALUES (?, ?, ?)
     RETURNING id, to_email, subject, status, created_at`
  ).bind(toEmail, subject, status).first();
  return {
    id: result!.id as number,
    toEmail: result!.to_email as string,
    subject: result!.subject as string,
    status: result!.status as string,
    createdAt: result!.created_at as number,
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