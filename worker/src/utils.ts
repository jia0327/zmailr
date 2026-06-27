/**
 * 生成随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
export function generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * 生成随机邮箱地址
   * @returns 随机邮箱地址
   */
  export function generateRandomAddress(): string {
    // 生成8-12位随机字符
    const length = Math.floor(Math.random() * 5) + 8;
    return generateRandomString(length);
  }
  
  /**
   * 生成唯一ID
   * @returns 唯一ID
   */
  export function generateId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * 获取当前时间戳（秒）
   * @returns 当前时间戳
   */
  export function getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** Minimum interval between last_used_at writes per token (seconds). */
  export const TOKEN_LAST_USED_TOUCH_INTERVAL_SEC = 3600;

  export function shouldTouchTokenLastUsed(
    lastUsedAt: number | null | undefined,
    nowSec: number
  ): boolean {
    if (lastUsedAt == null) return true;
    return nowSec - lastUsedAt >= TOKEN_LAST_USED_TOUCH_INTERVAL_SEC;
  }
  
  /**
   * 计算过期时间戳
   * @param hours 小时数
   * @returns 过期时间戳
   */
  export function calculateExpiryTimestamp(hours: number): number {
    return getCurrentTimestamp() + (hours * 60 * 60);
  }
  
  /**
   * 检查字符串是否为有效的邮箱地址格式
   * @param address 邮箱地址
   * @returns 是否有效
   */
  export function isValidEmailAddress(address: string): boolean {
    // 简单的邮箱格式验证
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(address);
  }
  
  /**
   * 提取邮箱地址的用户名部分
   * @param address 完整邮箱地址
   * @returns 用户名部分
   */
  export function extractMailboxName(address: string): string {
    return address.split('@')[0];
  }

  /** 从完整邮箱地址提取域名（小写） */
  export function extractEmailDomain(email: string): string {
    const at = email.lastIndexOf('@');
    if (at < 0) {
      throw new Error('无效的邮箱地址');
    }
    return email.slice(at + 1).toLowerCase();
  }

  /** 将 local part 与域名拼成完整地址 */
  export function buildMailboxEmail(localPart: string, domain: string): string {
    return `${localPart}@${domain.toLowerCase()}`;
  }
  
  /**
   * 格式化日期时间
   * @param timestamp 时间戳（秒）
   * @returns 格式化的日期时间字符串
   */
  export function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toISOString();
  }

  /**
   * 获取邮件域名（优先 MAIL_DOMAIN，回退 VITE_EMAIL_DOMAIN 首项）
   */
  export function getMailDomain(env: { MAIL_DOMAIN?: string; VITE_EMAIL_DOMAIN?: string }): string {
    if (env.MAIL_DOMAIN) {
      return env.MAIL_DOMAIN.split(',')[0].trim();
    }
    const domains = (env.VITE_EMAIL_DOMAIN || '').split(',').map(d => d.trim()).filter(Boolean);
    return domains[0] || 'example.com';
  }

  /** Prefix for newly generated API tokens (e.g. zmr_a1b2…). */
  export const API_TOKEN_PREFIX = 'zmr_';

  /**
   * 生成 API Token（zmr_ + 64 位 hex）
   */
  export function generateApiToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${API_TOKEN_PREFIX}${hex}`;
  }

  /**
   * 从完整邮箱地址提取 local part
   */
  export function parseMailboxAddress(emailOrLocal: string): string {
    return emailOrLocal.includes('@') ? emailOrLocal.split('@')[0] : emailOrLocal;
  }

  /**
   * 校验 /api/send 的 from 地址：格式合法且域名与系统邮件域一致
   */
  /** Sender domain for extract rules: * or lowercase hostname (e.g. example.com) */
  const EXTRACT_RULE_DOMAIN = /^(\*|[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*)$/;

  export function validateExtractRuleInput(params: {
    domain?: string;
    regex?: string;
  }): { ok: true; domain: string; regex: string } | { ok: false; error: string } {
    const regex = params.regex?.trim();
    if (!regex) {
      return { ok: false, error: '缺少 regex' };
    }
    try {
      new RegExp(regex, 'i');
    } catch {
      return { ok: false, error: '正则表达式无效' };
    }
    const domain = (params.domain?.trim() || '*').toLowerCase();
    if (!EXTRACT_RULE_DOMAIN.test(domain)) {
      return { ok: false, error: '域名格式无效，请使用 * 或 example.com' };
    }
    return { ok: true, domain, regex };
  }

  export function validateSendFromAddress(
    from: string,
    allowedDomains: string | string[]
  ): { ok: true; localPart: string; fromEmail: string } | { ok: false; error: string } {
    const trimmed = from.trim();
    if (!trimmed.includes('@')) {
      return { ok: false, error: 'from 必须是完整邮箱地址' };
    }
    if (!isValidEmailAddress(trimmed)) {
      return { ok: false, error: '无效的 from 地址' };
    }
    const at = trimmed.lastIndexOf('@');
    const localPart = trimmed.slice(0, at);
    const fromDomain = trimmed.slice(at + 1).toLowerCase();
    const domains = (Array.isArray(allowedDomains) ? allowedDomains : [allowedDomains]).map((d) =>
      d.toLowerCase()
    );
    if (!domains.includes(fromDomain)) {
      return { ok: false, error: 'from 域名与系统允许的域名不匹配' };
    }
    return { ok: true, localPart, fromEmail: `${localPart}@${fromDomain}` };
  }

  /** 平台邮箱根域名格式校验（不含 @） */
  const MAIL_HOST_DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

  export function validateMailDomainHostname(
    domain: string
  ): { ok: true; domain: string } | { ok: false; error: string } {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) {
      return { ok: false, error: '域名不能为空' };
    }
    if (normalized.includes('@')) {
      return { ok: false, error: '请填写根域名，不要包含 @' };
    }
    if (!MAIL_HOST_DOMAIN.test(normalized)) {
      return { ok: false, error: '域名格式无效，请使用 example.com 形式' };
    }
    return { ok: true, domain: normalized };
  }
