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

  /**
   * 生成 API Token（64 位 hex）
   */
  export function generateApiToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 从完整邮箱地址提取 local part
   */
  export function parseMailboxAddress(emailOrLocal: string): string {
    return emailOrLocal.includes('@') ? emailOrLocal.split('@')[0] : emailOrLocal;
  }
