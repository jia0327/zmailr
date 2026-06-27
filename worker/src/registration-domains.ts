/** 允许用于注册的知名邮箱域名（小写） */
export const ALLOWED_REGISTRATION_EMAIL_DOMAINS = new Set([
  // 腾讯
  'qq.com',
  'foxmail.com',
  'vip.qq.com',
  // 网易
  '163.com',
  '126.com',
  'yeah.net',
  '188.com',
  'vip.163.com',
  'vip.126.com',
  // 谷歌
  'gmail.com',
  'googlemail.com',
  // 苹果
  'icloud.com',
  'me.com',
  'mac.com',
  // 微软
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'outlook.cn',
  'hotmail.cn',
  'live.cn',
  // 搜狐
  'sohu.com',
  // 其他常见知名邮箱
  'sina.com',
  'sina.cn',
  '139.com',
  'aliyun.com',
]);

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRegistrationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractEmailDomain(email: string): string | null {
  const normalized = normalizeRegistrationEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

export function isAllowedRegistrationEmail(email: string): boolean {
  const normalized = normalizeRegistrationEmail(email);
  if (!EMAIL_FORMAT_RE.test(normalized)) return false;
  const domain = extractEmailDomain(normalized);
  if (!domain) return false;
  return ALLOWED_REGISTRATION_EMAIL_DOMAINS.has(domain);
}

export function registrationEmailDomainHint(): string {
  return '腾讯(QQ/foxmail)、网易(163/126)、Gmail、iCloud、Outlook/Hotmail、搜狐等';
}
