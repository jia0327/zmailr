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

export interface RegistrationDomainGroup {
  label: string;
  domains: string[];
}

/** 注册页域名下拉分组（展示顺序） */
export const REGISTRATION_EMAIL_DOMAIN_GROUPS: RegistrationDomainGroup[] = [
  { label: '腾讯', domains: ['qq.com', 'foxmail.com', 'vip.qq.com'] },
  { label: '网易', domains: ['163.com', '126.com', 'yeah.net', '188.com', 'vip.163.com', 'vip.126.com'] },
  { label: '谷歌', domains: ['gmail.com', 'googlemail.com'] },
  { label: '苹果', domains: ['icloud.com', 'me.com', 'mac.com'] },
  {
    label: '微软',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.cn', 'hotmail.cn', 'live.cn'],
  },
  { label: '搜狐', domains: ['sohu.com'] },
  { label: '其他', domains: ['sina.com', 'sina.cn', '139.com', 'aliyun.com'] },
];

export const DEFAULT_REGISTRATION_EMAIL_DOMAIN = 'qq.com';

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_PART_RE = /^[a-zA-Z0-9._+-]+$/;

export function listAllowedRegistrationEmailDomains(): string[] {
  return [...ALLOWED_REGISTRATION_EMAIL_DOMAINS].sort((a, b) => a.localeCompare(b));
}

export function getRegistrationDomainGroups(): RegistrationDomainGroup[] {
  return REGISTRATION_EMAIL_DOMAIN_GROUPS;
}

export function normalizeRegistrationLocalPart(localPart: string): string {
  return localPart.trim().toLowerCase();
}

export function buildRegistrationEmail(localPart: string, domain: string): string {
  return `${normalizeRegistrationLocalPart(localPart)}@${domain.trim().toLowerCase()}`;
}

export function validateRegistrationLocalPart(localPart: string): string | null {
  const trimmed = localPart.trim();
  if (!trimmed) return '请输入邮箱前缀';
  if (trimmed.includes('@')) return '只需填写 @ 前面的前缀';
  if (trimmed.length > 64) return '邮箱前缀过长';
  if (!LOCAL_PART_RE.test(trimmed)) return '邮箱前缀仅支持字母、数字及 . _ + -';
  return null;
}

export function isAllowedRegistrationDomain(domain: string): boolean {
  return ALLOWED_REGISTRATION_EMAIL_DOMAINS.has(domain.trim().toLowerCase());
}

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
