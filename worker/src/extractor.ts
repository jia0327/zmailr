import { D1Database } from '@cloudflare/workers-types';
import { getEnabledExtractRules } from './database';

/** 通用兜底正则（支持「验证码为/是：123456」等常见中文格式） */
export const GENERIC_CODE_REGEX =
  /(?:code|验证码|verification|pin|otp)(?:[是为])?[：:\s]*(\d{4,8})/i;

/** 主题含验证码语义时，正文中独立的 6 位数字 */
export const SUBJECT_VERIFICATION_HINT =
  /(?:验证码|verification|verify|code|otp)/i;
export const STANDALONE_SIX_DIGIT = /\b(\d{6})\b/;

/** 首次初始化时写入 extract_rules（user_id IS NULL）的默认全局规则 */
export const SEED_GLOBAL_EXTRACT_RULES = [
  {
    seedKey: 'generic-keyword',
    domain: '*',
    regex: GENERIC_CODE_REGEX.source,
    priority: -100,
    remark:
      '匹配 code、验证码、verification、pin、otp 等关键词后的 4–8 位数字，支持「为/是：」等中文格式',
  },
  {
    seedKey: 'subject-hint-six-digit',
    domain: '*',
    regex: STANDALONE_SIX_DIGIT.source,
    priority: -101,
    remark:
      '主题含验证码语义时，从正文提取独立的 6 位数字（适用于正文仅含数字、无关键词的场景）',
  },
] as const;

/**
 * 从邮件正文中提取验证码
 *
 * 优先级（高 → 低）：
 * 1. 用户自定义规则（mailbox.userId 对应 extract_rules.user_id）
 * 2. 全局自定义规则（admin，extract_rules.user_id IS NULL）
 *    同层内：发件人域名精确匹配 > 通配符 *，再按 priority 降序
 * 3. 代码兜底（matchGenericCode：关键词正则 + 主题语义下的 6 位数字）
 */
export async function extractCode(
  db: D1Database,
  text: string,
  subject: string,
  fromAddress: string,
  userId?: number | null
): Promise<string | null> {
  const senderDomain = fromAddress.split('@')[1]?.toLowerCase() || '';
  const combined = `${subject}\n${text}`;

  const rules = await getEnabledExtractRules(db, senderDomain, userId);

  for (const rule of rules) {
    const code = matchWithRegex(combined, rule.regex);
    if (code) return code;
  }

  return matchGenericCode(combined, text, subject);
}

export function matchGenericCode(
  combined: string,
  body?: string,
  subject?: string
): string | null {
  const genericMatch = combined.match(GENERIC_CODE_REGEX);
  if (genericMatch) return genericMatch[1];

  if (body && subject && SUBJECT_VERIFICATION_HINT.test(subject)) {
    const standalone = body.match(STANDALONE_SIX_DIGIT);
    if (standalone) return standalone[1];
  }

  return null;
}

/** Common verification-link patterns (verify, confirm, token, etc.) */
const VERIFICATION_URL_PATTERN =
  /https?:\/\/[^\s<>"']+(?:verify|confirm|activation|validate|token|code|auth|signin|login)[^\s<>"']*/gi;

const HREF_VERIFICATION_PATTERN =
  /href=["'](https?:\/\/[^"']+(?:verify|confirm|activation|validate|token|code|auth|signin|login)[^"']*)["']/gi;

const GENERIC_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function normalizeUrl(url: string): string {
  return url.replace(/&amp;/g, '&').replace(/[.,;:!?)]+$/, '');
}

function isLikelyVerificationUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('unsubscribe') || lower.includes('privacy') || lower.includes('logo')) {
    return false;
  }
  return true;
}

/**
 * Extract the most likely verification link from email body/html.
 */
export function extractLink(text: string, html?: string): string | null {
  const combined = [html, text].filter(Boolean).join('\n');
  if (!combined) return null;

  for (const pattern of [VERIFICATION_URL_PATTERN, HREF_VERIFICATION_PATTERN]) {
    const matches = combined.matchAll(pattern);
    for (const match of matches) {
      const url = normalizeUrl(match[1] || match[0]);
      if (isLikelyVerificationUrl(url)) return url;
    }
  }

  const generic = combined.matchAll(GENERIC_URL_PATTERN);
  for (const match of generic) {
    const url = normalizeUrl(match[0]);
    if (isLikelyVerificationUrl(url)) return url;
  }

  return null;
}

export function matchWithRegex(text: string, pattern: string): string | null {
  try {
    const regex = new RegExp(pattern, 'i');
    const match = text.match(regex);
    if (!match) return null;
    if (match[1]) return match[1];
    const digits = match[0].match(/\d{4,8}/);
    return digits ? digits[0] : null;
  } catch (error) {
    console.error('正则表达式无效:', pattern, error);
    return null;
  }
}
