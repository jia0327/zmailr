import { D1Database } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, ApiAuthContext, TokenScope, User, Mailbox, Email } from './types';
import { 
  createMailbox, 
  getMailbox,
  getMailboxById,
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
  listUserExtractRules,
  createExtractRule,
  updateGlobalExtractRule,
  deleteGlobalExtractRule,
  updateUserExtractRule,
  deleteUserExtractRule,
  listSentEmails,
  listUserSentEmails,
  getAdminStats,
  listUserTokens,
  countUserTokens,
  createUserToken,
  deleteUserToken,
  getDailyUsage,
  countEmailsReceivedForUser,
  countUserMailboxes,
  countUserExtractRules,
  getUserTokenSummary,
  checkSendQuota,
  incrementSendUsage,
  incrementLeaseUsage,
  isMailboxOwnedByUser,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listMailboxesByUser,
  listActiveMailboxes,
  findInstantLatestEmailWithCode,
  findInstantLatestEmail,
  getEmailRawContent,
} from './database';
import { generateRandomAddress, getMailDomain, parseMailboxAddress, getCurrentTimestamp, validateSendFromAddress, validateExtractRuleInput } from './utils';
import {
  authenticateApiToken,
  hasScope,
  assertMailboxAccess,
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
import { getBuiltinExtractRules, extractLink } from './extractor';
import {
  consumeRateLimit,
  DEFAULT_GLOBAL_IP_RATE_LIMIT,
  getGlobalIpRateLimitKey,
  rateLimitHeaders,
  rateLimitExceededBody,
  getClientIp,
} from './rate-limit';

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

async function globalIpRateLimitMiddleware(c: any, next: () => Promise<void>) {
  const rateKey = getGlobalIpRateLimitKey(c.req.header('CF-Connecting-IP'));
  const result = await consumeRateLimit(c.env.DB, rateKey, DEFAULT_GLOBAL_IP_RATE_LIMIT);
  if (!result.ok) {
    return c.json(rateLimitExceededBody(), 429, rateLimitHeaders(result));
  }
  for (const [key, value] of Object.entries(rateLimitHeaders(result))) {
    c.header(key, value);
  }
  await next();
}

app.use('/api/*', globalIpRateLimitMiddleware);
app.use('/admin/api/*', globalIpRateLimitMiddleware);

// 健康检查端点
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: '临时邮箱系统API正常运行' });
});

// 获取系统配置
app.get('/api/config', async (c) => {
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


// 创建邮箱（已废弃匿名创建；请使用 POST /api/user/mailboxes 或 POST /api/lease）
app.post('/api/mailboxes', async (c) => {
  return c.json({
    success: false,
    error: '未授权，请登录后使用 POST /api/user/mailboxes，或使用 Bearer Token 调用 POST /api/lease',
  }, 401);
});

// 列出活跃邮箱（Bearer Token）
app.get('/api/mailboxes', async (c) => {
  const authErr = await requireApiAuth(c, 'mail');
  if (authErr) return authErr;
  const auth = c.get('auth')!;

  try {
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
    const mailboxes =
      auth.type === 'user' && auth.userId != null
        ? await listMailboxesByUser(c.env.DB, auth.userId, limit)
        : await listActiveMailboxes(c.env.DB, limit);

    const domain = getMailDomain(c.env);
    return c.json({
      success: true,
      mailboxes: mailboxes.map((m) => ({
        ...m,
        email: `${m.address}@${domain}`,
      })),
    });
  } catch (error) {
    console.error('列出邮箱失败:', error);
    return c.json({
      success: false,
      error: '列出邮箱失败',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
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

    const accessErr = await requireMailboxAuth(c, mailbox, 'mail');
    if (accessErr) return accessErr;
    
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
    const mailbox = await getMailbox(c.env.DB, address);
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在' }, 404);
    }

    const accessErr = await requireMailboxAuth(c, mailbox, 'mail');
    if (accessErr) return accessErr;

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

// 即时获取最新验证码（Bearer Token，非阻塞）
app.get('/api/mailboxes/:address/latest-code', async (c) => {
  const authErr = await requireApiAuth(c, 'mail');
  if (authErr) return authErr;

  try {
    const resolved = await resolveMailboxFromParam(c, c.req.param('address'));
    if (resolved.error) return resolved.error;

    const accessErr = await requireMailboxAuth(c, resolved.mailbox!, 'mail');
    if (accessErr) return accessErr;

    const email = await findInstantLatestEmailWithCode(c.env.DB, resolved.mailbox!.id);
    if (!email) {
      return c.json({ success: false, error: 'no_code', message: '暂无验证码' }, 404);
    }

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
  } catch (error) {
    console.error('获取最新验证码失败:', error);
    return c.json({
      success: false,
      error: '获取最新验证码失败',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// 即时获取最新验证链接（Bearer Token）
app.get('/api/mailboxes/:address/latest-link', async (c) => {
  const authErr = await requireApiAuth(c, 'mail');
  if (authErr) return authErr;

  try {
    const resolved = await resolveMailboxFromParam(c, c.req.param('address'));
    if (resolved.error) return resolved.error;

    const accessErr = await requireMailboxAuth(c, resolved.mailbox!, 'mail');
    if (accessErr) return accessErr;

    const email = await findInstantLatestEmail(c.env.DB, resolved.mailbox!.id);
    if (!email) {
      return c.json({ success: false, error: 'no_email', message: '暂无邮件' }, 404);
    }

    const link = extractLink(email.textContent || '', email.htmlContent || '');
    if (!link) {
      return c.json({ success: false, error: 'no_link', message: '未找到验证链接' }, 404);
    }

    return c.json({
      success: true,
      link,
      email: {
        id: email.id,
        subject: email.subject,
        from: email.fromAddress,
        receivedAt: email.receivedAt,
      },
    });
  } catch (error) {
    console.error('获取最新链接失败:', error);
    return c.json({
      success: false,
      error: '获取最新链接失败',
      message: error instanceof Error ? error.message : String(error),
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

    const accessErr = await requireMailboxAuth(c, mailbox, 'mail');
    if (accessErr) return accessErr;
    
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
    const access = await requireEmailAccess(c, id, 'mail');
    if (access instanceof Response) return access;

    return c.json({ success: true, email: access.email });
  } catch (error) {
    console.error('获取邮件详情失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮件详情失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 下载原始邮件（Bearer mail scope 或登录会话 + 所有权）
app.get('/api/emails/:id/raw', async (c) => {
  try {
    const id = c.req.param('id');
    const access = await requireEmailAccess(c, id, 'mail');
    if (access instanceof Response) return access;

    const raw = await getEmailRawContent(c.env.DB, id);
    if (!raw) {
      return c.json({ success: false, error: '邮件不存在' }, 404);
    }

    c.header('Content-Type', 'message/rfc822');
    c.header('Content-Disposition', `attachment; filename="${id}.eml"`);
    return c.body(raw);
  } catch (error) {
    console.error('获取原始邮件失败:', error);
    return c.json({
      success: false,
      error: '获取原始邮件失败',
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// 获取邮件的附件列表
app.get('/api/emails/:id/attachments', async (c) => {
  try {
    const id = c.req.param('id');
    const access = await requireEmailAccess(c, id, 'mail');
    if (access instanceof Response) return access;
    
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

    const access = await requireEmailAccess(c, attachment.emailId, 'mail');
    if (access instanceof Response) return access;
    
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
    const access = await requireEmailAccess(c, id, 'mail');
    if (access instanceof Response) return access;

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
  const [mailboxesCount, messagesReceivedCount, customRulesCount, token] = await Promise.all([
    countUserMailboxes(c.env.DB, user.id),
    countEmailsReceivedForUser(c.env.DB, user.id),
    countUserExtractRules(c.env.DB, user.id),
    getUserTokenSummary(c.env.DB, user.id),
  ]);
  const sendRemaining = user.dailySendQuota < 0
    ? -1
    : Math.max(0, user.dailySendQuota - usage.sendCount);
  return c.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      dailySendQuota: user.dailySendQuota,
      sendCountToday: usage.sendCount,
      sendRemaining,
    },
    usage: {
      sendCount: usage.sendCount,
      leaseCount: usage.leaseCount,
      usageDate: usage.usageDate,
      sendRemaining,
    },
    stats: {
      mailboxesCount,
      messagesReceivedCount,
      customRulesCount,
      token,
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
  const existingCount = await countUserTokens(c.env.DB, user.id);
  if (existingCount > 0) {
    return c.json({ success: false, error: '每位用户仅可创建一个 API Token，请先删除现有 Token' }, 400);
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

// ─── 用户提取规则（会话鉴权） ───────────────────────────────

app.get('/api/user/extract-rules', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const rules = await listUserExtractRules(c.env.DB, user.id);
  const builtinRules = getBuiltinExtractRules();
  return c.json({ success: true, rules, builtinRules });
});

app.post('/api/user/extract-rules', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const body = await c.req.json();
  const validated = validateExtractRuleInput(body);
  if (!validated.ok) return c.json({ success: false, error: validated.error }, 400);
  const rule = await createExtractRule(c.env.DB, {
    domain: validated.domain,
    regex: validated.regex,
    priority: body.priority,
    enabled: body.enabled,
    userId: user.id,
  });
  return c.json({ success: true, rule });
});

app.put('/api/user/extract-rules/:id', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const body = await c.req.json();
  const validated = validateExtractRuleInput(body);
  if (!validated.ok) return c.json({ success: false, error: validated.error }, 400);
  const rule = await updateUserExtractRule(
    c.env.DB,
    parseInt(c.req.param('id'), 10),
    user.id,
    {
      domain: validated.domain,
      regex: validated.regex,
      priority: body.priority,
      enabled: body.enabled,
    }
  );
  if (!rule) return c.json({ success: false, error: '规则不存在' }, 404);
  return c.json({ success: true, rule });
});

app.delete('/api/user/extract-rules/:id', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const ok = await deleteUserExtractRule(c.env.DB, parseInt(c.req.param('id'), 10), user.id);
  if (!ok) return c.json({ success: false, error: '规则不存在' }, 404);
  return c.json({ success: true });
});

app.get('/api/user/sent', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
  const emails = await listUserSentEmails(c.env.DB, user.id, limit);
  return c.json({ success: true, emails });
});

app.get('/api/user/mailboxes', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
  const mailboxes = await listMailboxesByUser(c.env.DB, user.id, limit);
  const domain = getMailDomain(c.env);
  return c.json({
    success: true,
    mailboxes: mailboxes.map((m) => ({
      ...m,
      email: `${m.address}@${domain}`,
    })),
  });
});

app.post('/api/user/mailboxes', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  try {
    const body = await c.req.json().catch(() => ({}));
    if (body.address && typeof body.address !== 'string') {
      return c.json({ success: false, error: '无效的邮箱地址' }, 400);
    }

    const ip = getClientIp(c.req.raw);
    const address = body.address || generateRandomAddress();

    const existingMailbox = await getMailbox(c.env.DB, address);
    if (existingMailbox) {
      return c.json({ success: false, error: '邮箱地址已存在' }, 400);
    }

    const mailbox = await createMailbox(c.env.DB, {
      address,
      expiresInHours: 24,
      ipAddress: ip,
      userId: user.id,
    });

    return c.json({ success: true, mailbox });
  } catch (error) {
    console.error('创建用户邮箱失败:', error);
    return c.json({
      success: false,
      error: '创建邮箱失败',
      message: error instanceof Error ? error.message : String(error),
    }, 400);
  }
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

async function resolveMailboxFromParam(c: any, addressParam: string) {
  const localPart = parseMailboxAddress(addressParam);
  const mailbox = await getMailbox(c.env.DB, localPart);
  if (!mailbox) {
    return { error: c.json({ success: false, error: '邮箱不存在或已过期' }, 404) };
  }
  return { mailbox, localPart };
}

async function requireMailboxAuth(
  c: any,
  mailbox: Mailbox,
  bearerScope: TokenScope = 'mail'
): Promise<Response | null> {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const authErr = await requireApiAuth(c, bearerScope);
    if (authErr) return authErr;
    const auth = c.get('auth') as ApiAuthContext;
    if (!assertMailboxAccess(mailbox, { auth })) {
      return c.json({ success: false, error: '无权访问该邮箱' }, 403);
    }
    return null;
  }

  const sessionErr = await requireUserSession(c);
  if (sessionErr) return sessionErr;
  const user = c.get('user') as User;
  if (!assertMailboxAccess(mailbox, { user })) {
    return c.json({ success: false, error: '无权访问该邮箱' }, 403);
  }
  return null;
}

async function requireEmailAccess(
  c: any,
  emailId: string,
  bearerScope: TokenScope = 'mail'
): Promise<Response | { email: Email; mailbox: Mailbox }> {
  const email = await getEmail(c.env.DB, emailId);
  if (!email) {
    return c.json({ success: false, error: '邮件不存在' }, 404);
  }

  const mailbox = await getMailboxById(c.env.DB, email.mailboxId);
  if (!mailbox) {
    return c.json({ success: false, error: '邮箱不存在' }, 404);
  }

  const accessErr = await requireMailboxAuth(c, mailbox, bearerScope);
  if (accessErr) return accessErr;

  return { email, mailbox };
}

// 租用临时邮箱
app.post('/api/lease', async (c) => {
  const authErr = await requireApiAuth(c, 'lease');
  if (authErr) return authErr;
  const auth = c.get('auth')!;

  try {
    const domain = getMailDomain(c.env);
    const address = generateRandomAddress();
    const ip = getClientIp(c.req.raw);

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

    const auth = c.get('auth')!;
    if (!assertMailboxAccess(mailbox, { auth })) {
      return c.json({ success: false, error: '无权访问该邮箱' }, 403);
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
  const validated = validateExtractRuleInput(body);
  if (!validated.ok) return c.json({ success: false, error: validated.error }, 400);
  const rule = await createExtractRule(c.env.DB, {
    domain: validated.domain,
    regex: validated.regex,
    priority: body.priority,
    enabled: body.enabled,
  });
  return c.json({ success: true, rule });
});

app.put('/admin/api/rules/:id', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const body = await c.req.json();
  const validated = validateExtractRuleInput(body);
  if (!validated.ok) return c.json({ success: false, error: validated.error }, 400);
  const rule = await updateGlobalExtractRule(c.env.DB, parseInt(c.req.param('id'), 10), {
    domain: validated.domain,
    regex: validated.regex,
    priority: body.priority,
    enabled: body.enabled,
  });
  if (!rule) return c.json({ success: false, error: '规则不存在' }, 404);
  return c.json({ success: true, rule });
});

app.delete('/admin/api/rules/:id', async (c) => {
  const authErr = await requireAdmin(c);
  if (authErr) return authErr;
  const ok = await deleteGlobalExtractRule(c.env.DB, parseInt(c.req.param('id'), 10));
  if (!ok) return c.json({ success: false, error: '规则不存在' }, 404);
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