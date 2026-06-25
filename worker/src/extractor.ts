import { D1Database } from '@cloudflare/workers-types';
import { getEnabledExtractRules } from './database';

/** 通用兜底正则 */
export const GENERIC_CODE_REGEX = /(?:code|验证码|verification|pin)[:\s]*(\d{4,8})/i;

/**
 * 从邮件正文中提取验证码
 * 优先匹配发件人域名的自定义规则，再回退通用正则
 */
export async function extractCode(
  db: D1Database,
  text: string,
  subject: string,
  fromAddress: string
): Promise<string | null> {
  const senderDomain = fromAddress.split('@')[1]?.toLowerCase() || '';
  const combined = `${subject}\n${text}`;

  const rules = await getEnabledExtractRules(db, senderDomain);

  for (const rule of rules) {
    const code = matchWithRegex(combined, rule.regex);
    if (code) return code;
  }

  return matchGenericCode(combined);
}

export function matchGenericCode(text: string): string | null {
  const genericMatch = text.match(GENERIC_CODE_REGEX);
  return genericMatch ? genericMatch[1] : null;
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
