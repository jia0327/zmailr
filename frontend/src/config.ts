// 配置文件，用于管理域名和API地址设置

export interface RegistrationDomainGroup {
  label: string;
  domains: string[];
}

export interface RegistrationConfig {
  enabled: boolean;
  allowedDomains: string[];
  domainGroups: RegistrationDomainGroup[];
  turnstile: {
    enabled: boolean;
    siteKey: string | null;
  };
}

const FALLBACK_REGISTRATION_DOMAIN_GROUPS: RegistrationDomainGroup[] = [
  { label: '腾讯', domains: ['qq.com', 'foxmail.com'] },
  { label: '网易', domains: ['163.com', '126.com'] },
  { label: '谷歌', domains: ['gmail.com'] },
  { label: '苹果', domains: ['icloud.com'] },
  { label: '微软', domains: ['outlook.com', 'hotmail.com'] },
  { label: '搜狐', domains: ['sohu.com'] },
];

// 邮箱域名配置 - 从 API 动态获取
let cachedEmailDomains: string[] | null = null;
let cachedRegistrationConfig: RegistrationConfig | null = null;
let configLoaded = false;

async function loadAppConfig(): Promise<void> {
  if (configLoaded) return;

  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.config) {
        cachedEmailDomains = data.config.emailDomains ?? ['example.com'];
        cachedRegistrationConfig = {
          enabled: !!data.config.registration?.enabled,
          allowedDomains: data.config.registration?.allowedDomains ?? [],
          domainGroups: data.config.registration?.domainGroups ?? FALLBACK_REGISTRATION_DOMAIN_GROUPS,
          turnstile: {
            enabled: !!data.config.turnstile?.enabled,
            siteKey: (data.config.turnstile?.siteKey as string | null) ?? null,
          },
        };
        configLoaded = true;
        return;
      }
    }
  } catch (error) {
    console.error('获取邮箱域名配置失败:', error);
  }

  const fallbackDomains = (import.meta.env.VITE_EMAIL_DOMAIN || '')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
  cachedEmailDomains = fallbackDomains.length > 0 ? fallbackDomains : ['example.com'];
  cachedRegistrationConfig = {
    enabled: false,
    allowedDomains: FALLBACK_REGISTRATION_DOMAIN_GROUPS.flatMap((g) => g.domains),
    domainGroups: FALLBACK_REGISTRATION_DOMAIN_GROUPS,
    turnstile: { enabled: false, siteKey: null },
  };
  configLoaded = true;
}

// 从 API 获取邮箱域名配置
export async function getEmailDomains(): Promise<string[]> {
  await loadAppConfig();
  return cachedEmailDomains!;
}

export async function getRegistrationConfig(): Promise<RegistrationConfig> {
  await loadAppConfig();
  return cachedRegistrationConfig!;
}

export async function isRegistrationEnabled(): Promise<boolean> {
  const config = await getRegistrationConfig();
  return config.enabled;
}

// 获取默认邮箱域名
export async function getDefaultEmailDomain(): Promise<string> {
  const domains = await getEmailDomains();
  return domains[0] || 'example.com';
}

// 同步版本的邮箱域名配置（用于向后兼容）
export const EMAIL_DOMAINS = (import.meta.env.VITE_EMAIL_DOMAIN || '').split(',').map(domain => domain.trim()).filter(domain => domain) || ['example.com'];
export const DEFAULT_EMAIL_DOMAIN = EMAIL_DOMAINS[0] || 'example.com';

/** 根据邮箱记录与回退域名拼出完整地址 */
export function formatMailboxEmail(mailbox: Mailbox, fallbackDomain: string = DEFAULT_EMAIL_DOMAIN): string {
  if (mailbox.email) return mailbox.email;
  const localPart = mailbox.address.includes('@') ? mailbox.address.split('@')[0] : mailbox.address;
  const domain = mailbox.mailDomain || fallbackDomain;
  return `${localPart}@${domain}`;
}

// API地址配置
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// 其他配置
export const DEFAULT_AUTO_REFRESH = true;
export const AUTO_REFRESH_INTERVAL = 15000; // 15秒
