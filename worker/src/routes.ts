import { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, ApiAuthContext, TokenScope, User } from './types';
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
  listUserTokens,
  createUserToken,
  deleteUserToken,
  getDailyUsage,
  checkSendQuota,
  incrementSendUsage,
  incrementLeaseUsage,
  isMailboxOwnedByUser,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from './database';
import { generateRandomAddress, getMailDomain, parseMailboxAddress, getCurrentTimestamp, validateSendFromAddress } from './utils';
import {
  authenticateApiToken,
  hasScope,
  isAdminAuthenticated,
  verifyAdminPassword,
  createAdminSessionCookie,
  clearAdminSessionCookie,
  getAuthenticatedUser,
  authenticateUserLogin,
  createUserSessionCookie,
  clearUserSessionCookie,
} from './auth';
import { sendMail } from './sender';
import { getAdminHtml } from './admin';
import { getBuiltinExtractRules } from './extractor';

type AppVariables = {
  auth?: ApiAuthContext;
  user?: User;
};

// 创建 Hono 应用
const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// 添加 CORS 中间件
app.use('/*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// 健康检查端点
app.get('/api/health', (c) => {
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

// ─── 用户认证（Web 会话） ─────────────────────────────────────

async function requireUserSession(c: any): Promise<Response | null> {
  const user = await getAuthenticatedUser(c.env.DB, c.req.raw, c.env);
  if (!user) {
    return c.json({ success: false, error: '未登录' }, 401);
  }
  c.set('user', user);
  return null;
}

app.post('/api/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.username || !body.password) {
      return c.json({ success: false, error: '缺少用户名或密码' }, 400);
    }
    const user = await authenticateUserLogin(c.env.DB, String(body.username), String(body.password));
    if (!user) {
      return c.json({ success: false, error: '用户名或密码错误' }, 401);
    }
    const cookie = await createUserSessionCookie(c.env, user.id);
    return c.json({ success: true, user: { id: user.id, username: user.username, role: user.role } }, 200, { 'Set-Cookie': cookie });
  } catch (error) {
    console.error('登录失败:', error);
    return c.json({ success: false, error: '登录失败' }, 500);
  }
});

app.post('/api/auth/logout', (c) => {
  return c.json({ success: true }, 200, { 'Set-Cookie': clearUserSessionCookie() });
});

app.get('/api/auth/me', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const usage = await getDailyUsage(c.env.DB, user.id);
  return c.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      dailySendQuota: user.dailySendQuota,
    },
    usage: {
      sendCount: usage.sendCount,
      leaseCount: usage.leaseCount,
      usageDate: usage.usageDate,
    },
  });
});

// ─── 用户 Token 管理（会话鉴权） ─────────────────────────────

app.get('/api/user/tokens', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const tokens = await listUserTokens(c.env.DB, user.id);
  return c.json({ success: true, tokens });
});

app.post('/api/user/tokens', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const body = await c.req.json();
  const expiresInDays = Math.min(Math.max(parseInt(body.expiresInDays) || 30, 1), 365);
  const validScopes: TokenScope[] = ['lease', 'mail', 'send'];
  const scopes: TokenScope[] = Array.isArray(body.scopes)
    ? body.scopes.filter((s: string) => validScopes.includes(s as TokenScope))
    : validScopes;
  if (scopes.length === 0) {
    return c.json({ success: false, error: '至少选择一个 scope' }, 400);
  }
  const token = await createUserToken(c.env.DB, user.id, {
    name: body.name,
    expiresInDays,
    scopes,
  });
  return c.json({ success: true, token });
});

app.delete('/api/user/tokens/:id', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const ok = await deleteUserToken(c.env.DB, user.id, parseInt(c.req.param('id'), 10));
  if (!ok) return c.json({ success: false, error: 'Token 不存在' }, 404);
  return c.json({ success: true });
});

// ─── Web 发信（会话鉴权 + 配额） ─────────────────────────────

async function resolveFromAddress(
  db: D1Database,
  from: string | undefined,
  domain: string,
  userId: number
): Promise<{ ok: true; fromEmail?: string } | { ok: false; error: string }> {
  if (from == null || from === '') {
    return { ok: true };
  }
  const validated = validateSendFromAddress(String(from), domain);
  if (!validated.ok) {
    return validated;
  }
  const owned = await isMailboxOwnedByUser(db, validated.localPart, userId);
  if (!owned) {
    const mailbox = await getMailbox(db, validated.localPart);
    if (!mailbox) {
      return { ok: false, error: 'from 邮箱不存在或已过期' };
    }
  }
  return { ok: true, fromEmail: validated.fromEmail };
}

app.post('/api/user/send', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  try {
    const body = await c.req.json();
    if (!body.to || !body.subject) {
      return c.json({ success: false, error: '缺少 to 或 subject 参数' }, 400);
    }
    if (!body.text && !body.html) {
      return c.json({ success: false, error: '缺少 text 或 html 内容' }, 400);
    }

    const quotaCheck = await checkSendQuota(c.env.DB, user.id, user.dailySendQuota);
    if (!quotaCheck.ok) {
      return c.json({ success: false, error: quotaCheck.error }, 429);
    }

    const domain = getMailDomain(c.env);
    const fromResult = await resolveFromAddress(c.env.DB, body.from, domain, user.id);
    if (!fromResult.ok) {
      return c.json({ success: false, error: fromResult.error }, 400);
    }

    const result = await sendMail(c.env.DB, c.env, {
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
      from: fromResult.fromEmail,
      userId: user.id,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 502);
    }

    await incrementSendUsage(c.env.DB, user.id);
    return c.json({ success: true, sentEmailId: result.sentEmailId });
  } catch (error) {
    console.error('Web 发信失败:', error);
    return c.json({
      success: false,
      error: '发送邮件失败',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ─── 程序化 API（需 Bearer Token 鉴权，不影响现有 Web 前端路由） ───

async function requireApiAuth(c: any, scope?: TokenScope): Promise<Response | null> {
  const auth = await authenticateApiToken(c.env.DB, c.req.raw);
  if (!auth) {
    return c.json({ success: false, error: '未授权，请提供有效的 Bearer Token' }, 401);
  }
  if (scope && !hasScope(auth, scope)) {
    return c.json({ success: false, error: `缺少 ${scope} 权限` }, 403);
  }
  c.set('auth', auth);
  return null;
}

// 租用临时邮箱
app.post('/api/lease', async (c) => {
  const authErr = await requireApiAuth(c, 'lease');
  if (authErr) return authErr;
  const auth = c.get('auth')!;

  try {
    const domain = getMailDomain(c.env);
    const address = generateRandomAddress();
    const ip = c.req.header('CF-Connecting-IP') || 'api';

    const mailbox = await createMailbox(c.env.DB, {
      address,
      expiresInHours: 24,
      ipAddress: ip,
      userId: auth.type === 'user' ? auth.userId : null,
    });

    if (auth.type === 'user' && auth.userId) {
      await incrementLeaseUsage(c.env.DB, auth.userId);
    }

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
  const authErr = await requireApiAuth(c, 'mail');
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
  const authErr = await requireApiAuth(c, 'send');
  if (authErr) return authErr;
  const auth = c.get('auth')!;

  try {
    const body = await c.req.json();
    if (!body.to || !body.subject) {
      return c.json({ success: false, error: '缺少 to 或 subject 参数' }, 400);
    }
    if (!body.text && !body.html) {
      return c.json({ success: false, error: '缺少 text 或 html 内容' }, 400);
    }

    if (auth.type === 'user' && auth.userId != null && auth.dailySendQuota != null) {
      const quotaCheck = await checkSendQuota(c.env.DB, auth.userId, auth.dailySendQuota);
      if (!quotaCheck.ok) {
        return c.json({ success: false, error: quotaCheck.error }, 429);
      }
    }

    const domain = getMailDomain(c.env);
    let fromEmail: string | undefined;
    if (body.from != null && body.from !== '') {
      const validated = validateSendFromAddress(String(body.from), domain);
      if (!validated.ok) {
        return c.json({ success: false, error: validated.error }, 400);
      }
      const mailbox = await getMailbox(c.env.DB, validated.localPart);
      if (!mailbox) {
        return c.json({ success: false, error: 'from 邮箱不存在或已过期' }, 404);
      }
      fromEmail = validated.fromEmail;
    }

    const result = await sendMail(c.env.DB, c.env, {
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
      from: fromEmail,
      userId: auth.userId ?? null,
      tokenId: auth.tokenId ?? null,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 502);
    }

    if (auth.type === 'user' && auth.userId) {
      await incrementSendUsage(c.env.DB, auth.userId);
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

app.get('/admin/api/users', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const users = await listUsers(c.env.DB);
  return c.json({ success: true, users });
});

app.post('/admin/api/users', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const body = await c.req.json();
  if (!body.username || !body.password) {
    return c.json({ success: false, error: '缺少 username 或 password' }, 400);
  }
  try {
    const user = await createUser(c.env.DB, {
      username: String(body.username),
      password: String(body.password),
      role: body.role === 'admin' ? 'admin' : 'user',
      dailySendQuota: parseInt(body.dailySendQuota) || 50,
    });
    return c.json({ success: true, user });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('UNIQUE')) {
      return c.json({ success: false, error: '用户名已存在' }, 400);
    }
    return c.json({ success: false, error: '创建用户失败' }, 500);
  }
});

app.put('/admin/api/users/:id', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const body = await c.req.json();
  const user = await updateUser(c.env.DB, parseInt(c.req.param('id'), 10), {
    role: body.role,
    dailySendQuota: body.dailySendQuota !== undefined ? parseInt(body.dailySendQuota) : undefined,
    enabled: body.enabled,
    password: body.password || undefined,
  });
  if (!user) return c.json({ success: false, error: '用户不存在' }, 404);
  return c.json({ success: true, user });
});

app.delete('/admin/api/users/:id', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const ok = await deleteUser(c.env.DB, parseInt(c.req.param('id'), 10));
  if (!ok) return c.json({ success: false, error: '用户不存在' }, 404);
  return c.json({ success: true });
});

// SPA fallback: serve static assets or index.html for frontend routes (/login, /account, etc.)
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.notFound();
});

export default app;