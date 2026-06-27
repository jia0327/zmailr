import * as PostalMimeModule from 'postal-mime';
import { Env, ParsedEmail } from './types';
import { getMailbox, saveEmail, saveAttachment } from './database';
import { extractCode } from './extractor';
import { resolveEnabledMailDomainNames } from './mail-domains';
import { extractEmailDomain } from './utils';

const PostalMime = PostalMimeModule.default;

/**
 * 处理接收到的邮件
 * @param message 邮件消息
 * @param env 环境变量
 */
export async function handleEmail(message: any, env: Env): Promise<void> {
  try {
    const parser = new PostalMime();
    const email = await parser.parse(message.raw) as ParsedEmail;

    console.log('邮件解析结果:', {
      subject: email.subject,
      from: email.from,
      to: email.to,
      hasHtml: !!email.html,
      hasText: !!email.text,
      attachmentsCount: email.attachments?.length || 0
    });

    // 提取收件地址（local part + 域名）
    const toFullAddress = email.to[0].address.trim().toLowerCase();
    const mailboxAddress = toFullAddress.split('@')[0];
    const toDomain = extractEmailDomain(toFullAddress);

    const enabledDomains = await resolveEnabledMailDomainNames(env.DB, env);
    if (!enabledDomains.includes(toDomain)) {
      console.log('收件域名未在后台启用或未配置 Email Routing:', toFullAddress, enabledDomains);
      throw new Error(`收件域名未启用: ${toDomain}`);
    }
    
    // 查找对应的邮箱（按 local part，任意已启用域名后缀均可收信）
    const mailbox = await getMailbox(env.DB, mailboxAddress);
    
    if (!mailbox) {
      console.log('邮箱不存在');
      throw new Error('邮箱不存在');
    }

    // 提取验证码
    const bodyText = email.text || stripHtml(email.html || '');
    const extractResult = await extractCode(
      env.DB,
      bodyText,
      email.subject || '',
      email.from.address,
      mailbox.userId
    );

    if (extractResult) {
      console.log('提取到验证码:', extractResult.code, '规则:', extractResult.ruleId);
    }

    const rawContent = rawMessageToString(message.raw);

    // 保存邮件
    const savedEmail = await saveEmail(env.DB, {
      mailboxId: mailbox.id,
      fromAddress: email.from.address,
      fromName: email.from.name || '',
      toAddress: toFullAddress,
      subject: email.subject || '',
      textContent: email.text || '',
      htmlContent: email.html || '',
      hasAttachments: !!email.attachments?.length,
      extractedCode: extractResult?.code ?? null,
      matchedRuleId: extractResult?.ruleId ?? null,
      rawContent,
    });

    // 保存附件（如果有）
    if (email.attachments && email.attachments.length > 0) {
      console.log(`开始保存 ${email.attachments.length} 个附件`);
      
      for (const attachment of email.attachments) {
        try {
          // 将 ArrayBuffer 转换为 Base64 字符串
          const base64Content = arrayBufferToBase64(attachment.content);
          
          // 计算附件大小（字节）
          const size = attachment.size || attachment.content.byteLength;
          
          // 保存附件
          await saveAttachment(env.DB, {
            emailId: savedEmail.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            content: base64Content,
            size: size
          }, { r2Bucket: env.ATTACHMENTS });
          
          console.log(`附件 ${attachment.filename} 保存成功`);
        } catch (attachmentError) {
          console.error(`保存附件 ${attachment.filename} 失败:`, attachmentError);
          // 继续处理其他附件，不中断流程
        }
      }
    }
  } catch (error) {
    console.error('处理邮件失败:', error);
    throw error;
  }
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 * @param buffer ArrayBuffer 数据
 * @returns Base64 字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function stripHtml(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const text = noScript.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

const MAX_RAW_STORE_BYTES = 1024 * 1024;

function rawMessageToString(raw: unknown): string | null {
  if (!raw) return null;
  let bytes: Uint8Array | null = null;
  if (typeof raw === 'string') {
    if (raw.length > MAX_RAW_STORE_BYTES) return raw.slice(0, MAX_RAW_STORE_BYTES);
    return raw;
  }
  if (raw instanceof Uint8Array) bytes = raw;
  else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
  if (!bytes) return null;
  const slice = bytes.byteLength > MAX_RAW_STORE_BYTES ? bytes.slice(0, MAX_RAW_STORE_BYTES) : bytes;
  return new TextDecoder('utf-8').decode(slice);
}