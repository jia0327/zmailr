import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env} from './types';
import { 
  createMailbox, 
  getMailbox, 
  deleteMailbox, 
  getEmails, 
  getEmail, 
  deleteEmail,
  getAttachments,
  getAttachment,
  findLatestEmailWithCode,
  findLatestEmail,
  getMailboxApiMailCursor,
  setMailboxApiMailCursor,
  listApiTokens,
  createApiToken,
  deleteApiToken,
  listExtractRules,
  createExtractRule,
  updateExtractRule,
  deleteExtractRule,
  listSentEmails,
  getAdminStats,
} from './database';
import { generateRandomAddress, getMailDomain, parseMailboxAddress, getCurrentTimestamp } from './utils';
import { authenticateApiToken, isAdminAuthenticated, verifyAdminPassword, createAdminSessionCookie, clearAdminSessionCookie } from './auth';
import { sendMail } from './sender';
import { getAdminHtml } from './admin';
import { getBuiltinExtractRules } from './extractor';

// 创建 Hono 应用
const app = new Hono<{ Bindings: Env }>();

// 添加 CORS 中间件
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// 健康检查端点
app.get('/', (c) => {
  return c.json({ status: 'ok', message: '临时邮箱系统API正常运行' });
});

// 获取系统配置
app.get('/api/config', (c) => {
  try {
    const emailDomains = c.env.VITE_EMAIL_DOMAIN || '';
    const domains = emailDomains.split(',').map((domain: string) => domain.trim()).filter((domain: string) => domain);
    
    return c.json({ 
      success: true, 
      config: {
        emailDomains: domains
      }
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return c.json({ 
      success: false, 
      error: '获取配置失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});


// 创建邮箱
app.post('/api/mailboxes', async (c) => {
  try {
    const body = await c.req.json();
    
    // 验证参数
    if (body.address && typeof body.address !== 'string') {
      return c.json({ success: false, error: '无效的邮箱地址' }, 400);
    }
    
    const expiresInHours = 24; // 固定24小时有效期
    
    // 获取客户端IP
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    
    // 生成或使用提供的地址
    const address = body.address || generateRandomAddress();
    
    // 检查邮箱是否已存在
    const existingMailbox = await getMailbox(c.env.DB, address);
    if (existingMailbox) {
      return c.json({ success: false, error: '邮箱地址已存在' }, 400);
    }
    
    // 创建邮箱
    const mailbox = await createMailbox(c.env.DB, {
      address,
      expiresInHours,
      ipAddress: ip,
    });
    
    return c.json({ success: true, mailbox });
  } catch (error) {
    console.error('创建邮箱失败:', error);
    return c.json({ 
      success: false, 
      error: '创建邮箱失败',
      message: error instanceof Error ? error.message : String(error)
    }, 400);
  }
});

// 获取邮箱信息
app.get('/api/mailboxes/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const mailbox = await getMailbox(c.env.DB, address);
    
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在' }, 404);
    }
    
    return c.json({ success: true, mailbox });
  } catch (error) {
    console.error('获取邮箱失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮箱失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 删除邮箱
app.delete('/api/mailboxes/:address', async (c) => {
  try {
    const address = c.req.param('address');
    await deleteMailbox(c.env.DB, address);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('删除邮箱失败:', error);
    return c.json({ 
      success: false, 
      error: '删除邮箱失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取邮件列表
app.get('/api/mailboxes/:address/emails', async (c) => {
  try {
    const address = c.req.param('address');
    const mailbox = await getMailbox(c.env.DB, address);
    
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在' }, 404);
    }
    
    const emails = await getEmails(c.env.DB, mailbox.id);
    
    return c.json({ success: true, emails });
  } catch (error) {
    console.error('获取邮件列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮件列表失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取邮件详情
app.get('/api/emails/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const email = await getEmail(c.env.DB, id);
    
    if (!email) {
      return c.json({ success: false, error: '邮件不存在' }, 404);
    }
    
    return c.json({ success: true, email });
  } catch (error) {
    console.error('获取邮件详情失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮件详情失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取邮件的附件列表
app.get('/api/emails/:id/attachments', async (c) => {
  try {
    const id = c.req.param('id');
    
    // 检查邮件是否存在
    const email = await getEmail(c.env.DB, id);
    if (!email) {
      return c.json({ success: false, error: '邮件不存在' }, 404);
    }
    
    // 获取附件列表
    const attachments = await getAttachments(c.env.DB, id);
    
    return c.json({ success: true, attachments });
  } catch (error) {
    console.error('获取附件列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取附件列表失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取附件详情
app.get('/api/attachments/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const attachment = await getAttachment(c.env.DB, id);
    
    if (!attachment) {
      return c.json({ success: false, error: '附件不存在' }, 404);
    }
    
    // 检查是否需要直接返回附件内容
    const download = c.req.query('download') === 'true';
    
    if (download) {
      // 将Base64内容转换为二进制
      const binaryContent = atob(attachment.content);
      const bytes = new Uint8Array(binaryContent.length);
      for (let i = 0; i < binaryContent.length; i++) {
        bytes[i] = binaryContent.charCodeAt(i);
      }
      
      // 设置响应头
      c.header('Content-Type', attachment.mimeType);
      c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      
      return c.body(bytes);
    }
    
    // 返回附件信息（不包含内容，避免响应过大）
    return c.json({ 
      success: true, 
      attachment: {
        id: attachment.id,
        emailId: attachment.emailId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
        isLarge: attachment.isLarge,
        chunksCount: attachment.chunksCount
      }
    });
  } catch (error) {
    console.error('获取附件详情失败:', error);
    return c.json({ 
      success: false, 
      error: '获取附件详情失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 删除邮件
app.delete('/api/emails/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await deleteEmail(c.env.DB, id);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('删除邮件失败:', error);
    return c.json({ 
      success: false, 
      error: '删除邮件失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ─── 程序化 API（需 Bearer Token 鉴权，不影响现有 Web 前端路由） ───

async function requireApiToken(c: any): Promise<Response | null> {
  const ok = await authenticateApiToken(c.env.DB, c.req.raw);
  if (!ok) {
    return c.json({ success: false, error: '未授权，请提供有效的 Bearer Token' }, 401);
  }
  return null;
}

// 租用临时邮箱
app.post('/api/lease', async (c) => {
  const authErr = await requireApiToken(c);
  if (authErr) return authErr;

  try {
    const domain = getMailDomain(c.env);
    const address = generateRandomAddress();
    const ip = c.req.header('CF-Connecting-IP') || 'api';

    const mailbox = await createMailbox(c.env.DB, {
      address,
      expiresInHours: 24,
      ipAddress: ip,
    });

    return c.json({
      success: true,
      email: `${address}@${domain}`,
      address: mailbox.address,
      expiresAt: mailbox.expiresAt,
    });
  } catch (error) {
    console.error('租用邮箱失败:', error);
    return c.json({
      success: false,
      error: '租用邮箱失败',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// 长轮询等待邮件并返回 extracted_code
app.get('/api/mail', async (c) => {
  const authErr = await requireApiToken(c);
  if (authErr) return authErr;

  try {
    const toParam = c.req.query('to');
    if (!toParam) {
      return c.json({ success: false, error: '缺少 to 参数' }, 400);
    }

    const timeoutSec = Math.min(Math.max(parseInt(c.req.query('timeout') || '60'), 1), 55);
    const sinceParam = c.req.query('since');
    const sinceTimestamp = sinceParam ? parseInt(sinceParam, 10) : getCurrentTimestamp();
    const requireCode = c.req.query('require_code') !== 'false';

    const localPart = parseMailboxAddress(toParam);
    const mailbox = await getMailbox(c.env.DB, localPart);
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在或已过期' }, 404);
    }

    const pollInterval = 2000;
    const deadline = Date.now() + timeoutSec * 1000;
    const excludeAfter = await getMailboxApiMailCursor(c.env.DB, mailbox.id);

    while (Date.now() < deadline) {
      const email = requireCode
        ? await findLatestEmailWithCode(c.env.DB, mailbox.id, sinceTimestamp, excludeAfter)
        : await findLatestEmail(c.env.DB, mailbox.id, sinceTimestamp, excludeAfter);

      if (email) {
        await setMailboxApiMailCursor(c.env.DB, mailbox.id, email.id, email.receivedAt);

        return c.json({
          success: true,
          code: email.extractedCode,
          email: {
            id: email.id,
            subject: email.subject,
            from: email.fromAddress,
            receivedAt: email.receivedAt,
          },
        });
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return c.json({ success: false, error: 'timeout', message: '等待邮件超时' }, 408);
  } catch (error) {
    console.error('轮询邮件失败:', error);
    return c.json({
      success: false,
      error: '轮询邮件失败',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// 发送邮件
app.post('/api/send', async (c) => {
  const authErr = await requireApiToken(c);
  if (authErr) return authErr;

  try {
    const body = await c.req.json();
    if (!body.to || !body.subject) {
      return c.json({ success: false, error: '缺少 to 或 subject 参数' }, 400);
    }
    if (!body.text && !body.html) {
      return c.json({ success: false, error: '缺少 text 或 html 内容' }, 400);
    }

    const result = await sendMail(c.env.DB, c.env, {
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 502);
    }

    return c.json({ success: true, sentEmailId: result.sentEmailId });
  } catch (error) {
    console.error('发送邮件失败:', error);
    return c.json({
      success: false,
      error: '发送邮件失败',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ─── 管理后台 ────────────────────────────────────────────────

async function requireAdmin(c: any): Promise<Response | null> {
  if (!(await isAdminAuthenticated(c.req.raw, c.env))) {
    return c.json({ success: false, error: '未授权' }, 401);
  }
  return null;
}

app.get('/admin', async (c) => {
  if (!(await isAdminAuthenticated(c.req.raw, c.env))) {
    return c.html(getAdminHtml());
  }
  return c.html(getAdminHtml());
});

app.post('/admin/login', async (c) => {
  try {
    if (!c.env.ADMIN_PASSWORD) {
      return c.json({ success: false, error: '未配置 ADMIN_PASSWORD' }, 503);
    }
    const body = await c.req.json();
    if (!verifyAdminPassword(c.env, body.password)) {
      return c.json({ success: false, error: '密码错误' }, 401);
    }
    const cookie = await createAdminSessionCookie(c.env);
    return c.json({ success: true }, 200, { 'Set-Cookie': cookie });
  } catch (error) {
    return c.json({ success: false, error: '登录失败' }, 500);
  }
});

app.post('/admin/logout', (c) => {
  return c.json({ success: true }, 200, { 'Set-Cookie': clearAdminSessionCookie() });
});

app.get('/admin/api/stats', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const stats = await getAdminStats(c.env.DB);
  return c.json({ success: true, stats });
});

app.get('/admin/api/tokens', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const tokens = await listApiTokens(c.env.DB);
  return c.json({ success: true, tokens });
});

app.post('/admin/api/tokens', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const body = await c.req.json();
  const expiresInDays = Math.min(Math.max(parseInt(body.expiresInDays) || 30, 1), 365);
  const token = await createApiToken(c.env.DB, { name: body.name, expiresInDays });
  return c.json({ success: true, token });
});

app.delete('/admin/api/tokens/:id', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  await deleteApiToken(c.env.DB, parseInt(c.req.param('id'), 10));
  return c.json({ success: true });
});

app.get('/admin/api/rules', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const rules = await listExtractRules(c.env.DB);
  const builtinRules = getBuiltinExtractRules();
  return c.json({ success: true, rules, builtinRules });
});

app.post('/admin/api/rules', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const body = await c.req.json();
  if (!body.regex) {
    return c.json({ success: false, error: '缺少 regex' }, 400);
  }
  const rule = await createExtractRule(c.env.DB, body);
  return c.json({ success: true, rule });
});

app.put('/admin/api/rules/:id', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const body = await c.req.json();
  const rule = await updateExtractRule(c.env.DB, parseInt(c.req.param('id'), 10), body);
  if (!rule) return c.json({ success: false, error: '规则不存在' }, 404);
  return c.json({ success: true, rule });
});

app.delete('/admin/api/rules/:id', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  await deleteExtractRule(c.env.DB, parseInt(c.req.param('id'), 10));
  return c.json({ success: true });
});

app.get('/admin/api/sent-emails', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const emails = await listSentEmails(c.env.DB);
  return c.json({ success: true, emails });
});

export default app;