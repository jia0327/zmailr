import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, ApiAuthContext, TokenScope, User, Mailbox, Email, MAX_USER_TOKENS } from './types';
import { 
  createMailbox, 
  getMailbox,
  getMailboxRaw,
  getMailboxRawById,
  deleteMailbox,
  reactivateMailbox,
  updateMailboxMailDomain,
  getEmails, 
  getEmail, 
  deleteEmail,
  deleteUserMailboxEmails,
  deleteUserSentEmails,
  getAttachments,
  getAttachment,
  findLatestEmailWithCode,
  findLatestEmail,
  getMailboxApiMailCursor,
  setMailboxApiMailCursor,
  listExtractRules,
  listUserExtractRules,
  createExtractRule,
  updateUserExtractRule,
  deleteUserExtractRule,
  listUserSentEmails,
  getUserSentEmailById,
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
  listMailboxesByUser,
  cleanupExpiredMailboxesForUser,
  findInstantLatestEmailWithCode,
  findInstantLatestEmail,
  getEmailRawContent,
  listUnreadAnnouncementsForUser,
  markAnnouncementRead,
  markAllAnnouncementsRead,
  getMaintenanceMode,
  getRegistrationSettings,
  writeAuditLog,
  getLegacySendDailyQuota,
} from './database';
import { generateRandomAddress, parseMailboxAddress, getCurrentTimestamp, validateExtractRuleInput, isValidEmailAddress } from './utils';
import { reExtractSingleEmail, scheduleReExtractAfterRuleChange } from './re-extract';
import {
  authenticateApiToken,
  hasScope,
  assertMailboxAccess,
  getAuthenticatedUser,
  resolveUserFromSessionOrBearer,
  authenticateUserLogin,
  createUserSessionCookie,
  clearUserSessionCookie,
  resolveOutboundFrom,
} from './auth';
import { sendMail, validateSendAttachments } from './sender';
import { extractLink } from './extractor';
import { isAdminRequest, isLegacyAdminRequest, stripAdminPrefix } from './admin-path';
import { createAdminApp } from './admin-routes';
import { resolveDefaultMailDomain, resolveEnabledMailDomainNames, assertEnabledMailDomain, formatMailboxEmail, resolveRandomMailDomain } from './mail-domains';
import {
  consumeRequestRateLimit,
  consumeRateLimit,
  rateLimitHeaders,
  rateLimitExceededBody,
  getClientIp,
  consumeLoginAttempt,
  recordLoginFailure,
  clearLoginFailures,
  getLegacySendRateLimitKey,
  LEGACY_SEND_WINDOW_MS,
} from './rate-limit';
import {
  buildMaintenanceDisplayMessage,
  checkMaintenanceBlock,
  getMaintenanceBlockedLabels,
  maintenanceBlockedBody,
} from './maintenance';
import { logRateLimitHit, logApiRequestStat } from './monitoring';
import { getOpenApiJson } from './openapi';
import { resolveAttachmentBytes } from './r2-attachments';
import { matchCorsOrigin } from './cors';
import { apiInternalError } from './http-response';
import { runHealthChecks } from './health';
import {
  sendRegistrationVerificationCode,
  verifyRegistrationCode,
  resendRegistrationVerificationCode,
} from './registration';
import { normalizeRegistrationEmail } from './registration-domains';

type AppVariables = {
  auth?: ApiAuthContext;
  user?: User;
  enabledMailDomains?: string[];
};

// 创建 Hono 应用
const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
const adminApp = createAdminApp();

// 管理后台：按 ADMIN_PATH 挂载；错误路径返回 404
app.use('*', async (c, next) => {
  const pathname = c.req.path;

  if (isLegacyAdminRequest(pathname, c.env)) {
    return c.notFound();
  }

  if (isAdminRequest(pathname, c.env)) {
    const url = new URL(c.req.url);
    url.pathname = stripAdminPrefix(pathname, c.env);
    const adminRequest = new Request(url, c.req.raw);
    return adminApp.fetch(adminRequest, c.env, c.executionCtx);
  }

  return await next();
});

// 加载已启用邮箱域名（供 CORS 与业务路由使用）
app.use('/*', async (c, next) => {
  const domains = await resolveEnabledMailDomainNames(c.env.DB, c.env);
  c.set('enabledMailDomains', domains);
  await next();
});

// CORS：仅允许配置的域名 + 本地开发源；拒绝未知 Origin
app.use('/*', cors({
  origin: (origin, c) => matchCorsOrigin(origin, c.env, c.get('enabledMailDomains')),
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.onError((error, c) => {
  console.error('未捕获的路由异常:', error);
  return c.json(apiInternalError('服务器内部错误', error), 500);
});

async function apiRateLimitMiddleware(c: any, next: () => Promise<void>) {
  const result = await consumeRequestRateLimit(c.env.DB, c.req.raw, c.env);
  if (!result.ok) {
    const user = await resolveUserFromSessionOrBearer(c.env.DB, c.req.raw, c.env);
    c.executionCtx.waitUntil(logRateLimitHit(c.env.DB, c.req.raw, user?.id ?? null));
    return c.json(rateLimitExceededBody(), 429, rateLimitHeaders(result));
  }
  for (const [key, value] of Object.entries(rateLimitHeaders(result))) {
    c.header(key, value);
  }
  await next();
}

async function apiRequestStatsMiddleware(c: any, next: () => Promise<void>) {
  await next();
  const status = c.res.status;
  c.executionCtx.waitUntil(logApiRequestStat(c.env.DB, c.req.raw, status));
}

async function maintenanceMiddleware(c: any, next: () => Promise<void>) {
  const block = await checkMaintenanceBlock(c.env.DB, c.req.path, c.req.method);
  if (block.blocked) {
    return c.json(maintenanceBlockedBody(block.mode), 503);
  }
  await next();
}

app.use('/api/*', maintenanceMiddleware);
app.use('/api/*', apiRateLimitMiddleware);
app.use('/api/*', apiRequestStatsMiddleware);

// 健康检查端点
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: '临时邮箱系统API正常运行' });
});

// 公开状态（维护模式横幅、依赖连通性探测，无需鉴权）
app.get('/api/public/status', async (c) => {
  const [maintenance, health] = await Promise.all([
    getMaintenanceMode(c.env.DB),
    runHealthChecks(c.env),
  ]);
  return c.json({
    success: true,
    status: health.status,
    maintenance: {
      enabled: maintenance.enabled,
      message: maintenance.message,
      displayMessage: buildMaintenanceDisplayMessage(maintenance),
      blockedFeatures: maintenance.enabled ? getMaintenanceBlockedLabels(maintenance) : [],
    },
    checks: health.checks,
  });
});

// 获取系统配置
app.get('/api/config', async (c) => {
  try {
    const domains = c.get('enabledMailDomains') ?? (await resolveEnabledMailDomainNames(c.env.DB, c.env));
    const [maintenance, registration] = await Promise.all([
      getMaintenanceMode(c.env.DB),
      getRegistrationSettings(c.env.DB),
    ]);

    return c.json({
      success: true,
      config: {
        emailDomains: domains,
        registration: {
          enabled: registration.enabled,
        },
        maintenance: {
          enabled: maintenance.enabled,
          message: maintenance.message,
          displayMessage: buildMaintenanceDisplayMessage(maintenance),
        },
      },
    });
  } catch (error) {
    return c.json(apiInternalError('获取配置失败', error), 500);
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

    if (auth.type === 'legacy') {
      return c.json({ success: false, error: 'legacy Token 不支持列出邮箱' }, 403);
    }

    if (auth.type !== 'user' || auth.userId == null) {
      return c.json({ success: false, error: '未授权' }, 401);
    }

    const mailboxes = await listMailboxesByUser(c.env.DB, auth.userId, { limit });

    const defaultDomain = await resolveDefaultMailDomain(c.env.DB, c.env);
    return c.json({
      success: true,
      mailboxes: mailboxes.mailboxes.map((m) => ({
        ...m,
        email: formatMailboxEmail(m, defaultDomain),
      })),
    });
  } catch (error) {
    return c.json(apiInternalError('列出邮箱失败', error), 500);
  }
});

async function resolveMailboxForAccess(c: any, addressParam: string) {
  const localPart = parseMailboxAddress(addressParam);
  let mailbox = await getMailbox(c.env.DB, localPart);
  if (!mailbox) {
    const raw = await getMailboxRaw(c.env.DB, localPart);
    if (raw) {
      const sessionErr = await requireUserSession(c);
      if (!sessionErr) {
        const user = c.get('user') as User;
        if (assertMailboxAccess(raw, { user })) {
          mailbox = raw;
        }
      }
    }
  }
  if (!mailbox) {
    return { error: c.json({ success: false, error: '邮箱不存在或已过期' }, 404) };
  }
  return { mailbox, localPart };
}

// 获取邮箱信息
app.get('/api/mailboxes/:address', async (c) => {
  try {
    const resolved = await resolveMailboxForAccess(c, c.req.param('address'));
    if (resolved.error) return resolved.error;

    const accessErr = await requireMailboxAuth(c, resolved.mailbox!, 'mail');
    if (accessErr) return accessErr;
    
    return c.json({ success: true, mailbox: resolved.mailbox });
  } catch (error) {
    return c.json(apiInternalError('获取邮箱失败', error), 500);
  }
});

// 删除邮箱
app.delete('/api/mailboxes/:address', async (c) => {
  try {
    const localPart = parseMailboxAddress(c.req.param('address'));
    const mailbox = await getMailboxRaw(c.env.DB, localPart);
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在' }, 404);
    }

    const accessErr = await requireMailboxAuth(c, mailbox, 'mail');
    if (accessErr) return accessErr;

    await deleteMailbox(c.env.DB, localPart);
    
    return c.json({ success: true });
  } catch (error) {
    return c.json(apiInternalError('删除邮箱失败', error), 500);
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
    return c.json(apiInternalError('获取最新验证码失败', error), 500);
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
    return c.json(apiInternalError('获取最新链接失败', error), 500);
  }
});

// 获取邮件列表
app.get('/api/mailboxes/:address/emails', async (c) => {
  try {
    const resolved = await resolveMailboxForAccess(c, c.req.param('address'));
    if (resolved.error) return resolved.error;

    const accessErr = await requireMailboxAuth(c, resolved.mailbox!, 'mail');
    if (accessErr) return accessErr;

    const domainFilter = c.req.query('domain')?.trim();
    const emails = domainFilter
      ? await getEmails(c.env.DB, resolved.mailbox!.id, {
          localPart: resolved.mailbox!.address,
          domain: domainFilter,
        })
      : await getEmails(c.env.DB, resolved.mailbox!.id);
    
    return c.json({ success: true, emails });
  } catch (error) {
    return c.json(apiInternalError('获取邮件列表失败', error), 500);
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
    return c.json(apiInternalError('获取邮件详情失败', error), 500);
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
    return c.json(apiInternalError('获取原始邮件失败', error), 500);
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
    return c.json(apiInternalError('获取附件列表失败', error), 500);
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
      const bytes = await resolveAttachmentBytes(attachment, c.env.ATTACHMENTS);
      if (!bytes) {
        return c.json({ success: false, error: '附件内容不存在' }, 404);
      }
      
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
    return c.json(apiInternalError('获取附件详情失败', error), 500);
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
    return c.json(apiInternalError('删除邮件失败', error), 500);
  }
});

// 重新提取验证码（Bearer mail scope 或登录会话 + 所有权）
app.post('/api/emails/:id/re-extract', async (c) => {
  try {
    const id = c.req.param('id');
    const access = await requireEmailAccess(c, id, 'mail');
    if (access instanceof Response) return access;

    const email = await reExtractSingleEmail(c.env.DB, id);
    if (!email) {
      return c.json({ success: false, error: '邮件不存在' }, 404);
    }

    return c.json({ success: true, email });
  } catch (error) {
    return c.json(apiInternalError('重新提取验证码失败', error), 500);
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
    const ip = getClientIp(c.req.raw);
    const limitCheck = await consumeLoginAttempt(c.env.DB, ip);
    if (!limitCheck.ok) {
      return c.json(rateLimitExceededBody(limitCheck.locked), 429, rateLimitHeaders(limitCheck));
    }

    const body = await c.req.json();
    if (!body.username || !body.password) {
      return c.json({ success: false, error: '缺少用户名或密码' }, 400);
    }
    const user = await authenticateUserLogin(c.env.DB, String(body.username), String(body.password));
    if (!user) {
      await recordLoginFailure(c.env.DB, ip);
      return c.json({ success: false, error: '用户名或密码错误' }, 401);
    }
    await clearLoginFailures(c.env.DB, ip);
    const cookie = await createUserSessionCookie(c.env, user.id);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'user',
        actorId: user.id,
        actorName: user.username,
        action: 'user.login',
        ip: getClientIp(c.req.raw),
      })
    );
    return c.json({ success: true, user: { id: user.id, username: user.username, role: user.role } }, 200, { 'Set-Cookie': cookie });
  } catch (error) {
    return c.json(apiInternalError('登录失败', error), 500);
  }
});

app.post('/api/auth/register/send-code', async (c) => {
  try {
    const ip = getClientIp(c.req.raw);
    const limitCheck = await consumeLoginAttempt(c.env.DB, ip, 'register');
    if (!limitCheck.ok) {
      return c.json(rateLimitExceededBody(limitCheck.locked), 429, rateLimitHeaders(limitCheck));
    }

    const body = await c.req.json();
    const email = body.email != null ? String(body.email) : '';
    const password = body.password != null ? String(body.password) : '';
    if (!email || !password) {
      return c.json({ success: false, error: '缺少邮箱或密码' }, 400);
    }

    const result = await sendRegistrationVerificationCode(c.env.DB, c.env, { email, password, ip });
    if (!result.ok) {
      return c.json({ success: false, error: result.error }, result.status ?? 400);
    }

    return c.json({
      success: true,
      message: '验证码已发送，请查收邮箱',
      email: normalizeRegistrationEmail(email),
    });
  } catch (error) {
    return c.json(apiInternalError('发送验证码失败', error), 500);
  }
});

app.post('/api/auth/register/resend', async (c) => {
  try {
    const ip = getClientIp(c.req.raw);
    const limitCheck = await consumeLoginAttempt(c.env.DB, ip, 'register-resend');
    if (!limitCheck.ok) {
      return c.json(rateLimitExceededBody(limitCheck.locked), 429, rateLimitHeaders(limitCheck));
    }

    const body = await c.req.json();
    const email = body.email != null ? String(body.email) : '';
    if (!email) {
      return c.json({ success: false, error: '缺少邮箱' }, 400);
    }

    const result = await resendRegistrationVerificationCode(c.env.DB, c.env, { email, ip });
    if (!result.ok) {
      return c.json({ success: false, error: result.error }, result.status ?? 400);
    }

    return c.json({ success: true, message: '验证码已重新发送' });
  } catch (error) {
    return c.json(apiInternalError('重发验证码失败', error), 500);
  }
});

app.post('/api/auth/register/verify', async (c) => {
  try {
    const ip = getClientIp(c.req.raw);
    const limitCheck = await consumeLoginAttempt(c.env.DB, ip, 'register-verify');
    if (!limitCheck.ok) {
      return c.json(rateLimitExceededBody(limitCheck.locked), 429, rateLimitHeaders(limitCheck));
    }

    const body = await c.req.json();
    const email = body.email != null ? String(body.email) : '';
    const code = body.code != null ? String(body.code) : '';
    if (!email || !code) {
      return c.json({ success: false, error: '缺少邮箱或验证码' }, 400);
    }

    const result = await verifyRegistrationCode(c.env.DB, { email, code });
    if (!result.ok) {
      if (!result.expired) {
        await recordLoginFailure(c.env.DB, ip, 'register-verify');
      }
      return c.json({ success: false, error: result.error }, result.status ?? 400);
    }

    await clearLoginFailures(c.env.DB, ip, 'register-verify');
    const cookie = await createUserSessionCookie(c.env, result.userId);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'user',
        actorId: result.userId,
        actorName: result.username,
        action: 'user.register',
        ip,
      })
    );
    return c.json(
      { success: true, user: { id: result.userId, username: result.username, role: 'user' } },
      200,
      { 'Set-Cookie': cookie }
    );
  } catch (error) {
    return c.json(apiInternalError('注册失败', error), 500);
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

function buildQuotaPayload(user: User, sentToday: number) {
  const unlimited = user.dailySendQuota < 0;
  return {
    dailySendQuota: user.dailySendQuota,
    sentToday,
    remaining: unlimited ? null : Math.max(0, user.dailySendQuota - sentToday),
    unlimited,
  };
}

app.get('/api/user/quota', async (c) => {
  const user = await resolveUserFromSessionOrBearer(c.env.DB, c.req.raw, c.env);
  if (!user) {
    return c.json({ success: false, error: '未授权' }, 401);
  }
  const usage = await getDailyUsage(c.env.DB, user.id);
  return c.json(buildQuotaPayload(user, usage.sendCount));
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
  if (existingCount >= MAX_USER_TOKENS) {
    return c.json({
      success: false,
      error: `每位用户最多可创建 ${MAX_USER_TOKENS} 个 API Token，请先删除现有 Token 后再创建。`,
    }, 400);
  }
  const token = await createUserToken(c.env.DB, user.id, {
    name: body.name,
    expiresInDays,
    scopes,
  });
  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      actorType: 'user',
      actorId: user.id,
      actorName: user.username,
      action: 'user.token.create',
      detail: { tokenId: token.id, name: token.name, scopes: token.scopes },
      ip: getClientIp(c.req.raw),
    })
  );
  return c.json({ success: true, token });
});

app.delete('/api/user/tokens/:id', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const tokenId = parseInt(c.req.param('id'), 10);
  const ok = await deleteUserToken(c.env.DB, user.id, tokenId);
  if (!ok) return c.json({ success: false, error: 'Token 不存在' }, 404);
  c.executionCtx.waitUntil(
    writeAuditLog(c.env.DB, {
      actorType: 'user',
      actorId: user.id,
      actorName: user.username,
      action: 'user.token.delete',
      detail: { tokenId },
      ip: getClientIp(c.req.raw),
    })
  );
  return c.json({ success: true });
});

// ─── 用户提取规则（会话鉴权） ───────────────────────────────

app.get('/api/user/extract-rules', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const rules = await listUserExtractRules(c.env.DB, user.id);
  const globalRules = await listExtractRules(c.env.DB);
  return c.json({ success: true, rules, globalRules });
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
    remark: body.remark,
    userId: user.id,
  });
  scheduleReExtractAfterRuleChange(c.executionCtx, c.env.DB, {
    userId: user.id,
    domain: rule.domain,
    enabled: rule.enabled,
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
      remark: body.remark,
    }
  );
  if (!rule) return c.json({ success: false, error: '规则不存在' }, 404);
  scheduleReExtractAfterRuleChange(c.executionCtx, c.env.DB, {
    userId: user.id,
    domain: rule.domain,
    enabled: rule.enabled,
  });
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

// ─── 用户公告（会话鉴权） ─────────────────────────────────────

app.get('/api/user/announcements/unread', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const announcements = await listUnreadAnnouncementsForUser(c.env.DB, user.id);
  return c.json({ success: true, announcements });
});

app.post('/api/user/announcements/:id/read', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const id = parseInt(c.req.param('id'), 10);
  if (Number.isNaN(id)) {
    return c.json({ success: false, error: '无效的公告 ID' }, 400);
  }
  const ok = await markAnnouncementRead(c.env.DB, user.id, id);
  if (!ok) return c.json({ success: false, error: '公告不存在或已禁用' }, 404);
  return c.json({ success: true });
});

app.post('/api/user/announcements/read-all', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const marked = await markAllAnnouncementsRead(c.env.DB, user.id);
  return c.json({ success: true, marked });
});

app.get('/api/user/sent', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const offset = (page - 1) * limit;
  const search = c.req.query('search') || c.req.query('q') || undefined;
  const { emails, total } = await listUserSentEmails(c.env.DB, user.id, {
    limit,
    offset,
    search,
  });
  return c.json({ success: true, emails, total, page, pageSize: limit });
});

app.get('/api/user/sent/:id', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const id = parseInt(c.req.param('id'), 10);
  if (Number.isNaN(id)) {
    return c.json({ success: false, error: '无效的 id' }, 400);
  }
  const email = await getUserSentEmailById(c.env.DB, user.id, id);
  if (!email) {
    return c.json({ success: false, error: '记录不存在' }, 404);
  }
  return c.json({ success: true, email });
});

app.post('/api/user/sent/:id/resend', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  const id = parseInt(c.req.param('id'), 10);
  if (Number.isNaN(id)) {
    return c.json({ success: false, error: '无效的 id' }, 400);
  }

  const record = await getUserSentEmailById(c.env.DB, user.id, id);
  if (!record) {
    return c.json({ success: false, error: '记录不存在' }, 404);
  }
  if (record.status === 'sent') {
    return c.json({ success: false, error: '仅失败邮件可重发' }, 400);
  }
  if (!record.bodyText && !record.bodyHtml) {
    return c.json({ success: false, error: '缺少邮件正文，无法重发' }, 400);
  }

  const quotaCheck = await checkSendQuota(c.env.DB, user.id, user.dailySendQuota);
  if (!quotaCheck.ok) {
    return c.json({ success: false, error: quotaCheck.error }, 429);
  }

  const result = await sendMail(c.env.DB, c.env, {
    to: record.toEmail,
    subject: record.subject,
    text: record.bodyText ?? undefined,
    html: record.bodyHtml ?? undefined,
    from: record.fromEmail ?? undefined,
    userId: user.id,
    attachments: record.attachments,
  });

  if (!result.success) {
    return c.json({ success: false, error: result.error }, 502);
  }

  await incrementSendUsage(c.env.DB, user.id);
  return c.json({ success: true, sentEmailId: result.sentEmailId });
});

app.delete('/api/user/sent', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  try {
    const body = await c.req.json().catch(() => ({}));
    const all = body.all === true;
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => parseInt(String(id), 10)).filter((id: number) => !Number.isNaN(id))
      : undefined;

    if (!all && (!ids || ids.length === 0)) {
      return c.json({ success: false, error: '请提供 ids 或设置 all: true' }, 400);
    }

    const deleted = await deleteUserSentEmails(c.env.DB, user.id, { ids, all });
    return c.json({ success: true, deleted });
  } catch (error) {
    return c.json(apiInternalError('删除发信记录失败', error), 500);
  }
});

app.get('/api/user/mailboxes', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const offset = (page - 1) * limit;
  const hasEmails = c.req.query('hasEmails') === 'true';
  const search = c.req.query('search') || c.req.query('q') || undefined;
  await cleanupExpiredMailboxesForUser(c.env.DB, user.id);
  const { mailboxes, total } = await listMailboxesByUser(c.env.DB, user.id, {
    limit,
    offset,
    includeExpired: false,
    hasEmails,
    search,
  });
  const defaultDomain = await resolveDefaultMailDomain(c.env.DB, c.env);
  const now = getCurrentTimestamp();
  return c.json({
    success: true,
    mailboxes: mailboxes.map((m) => ({
      ...m,
      email: formatMailboxEmail(m, defaultDomain),
      isExpired: m.expiresAt <= now,
    })),
    total,
    page,
    pageSize: limit,
  });
});

app.post('/api/user/mailboxes/:address/reactivate', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  try {
    const localPart = parseMailboxAddress(c.req.param('address'));
    const mailbox = await reactivateMailbox(c.env.DB, localPart, user.id);
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在或无权操作' }, 404);
    }
    return c.json({ success: true, mailbox });
  } catch (error) {
    return c.json(apiInternalError('续期邮箱失败', error), 500);
  }
});

app.delete('/api/user/emails', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  try {
    const body = await c.req.json().catch(() => ({}));
    const mailboxAddress = body.mailboxAddress ? parseMailboxAddress(String(body.mailboxAddress)) : '';
    if (!mailboxAddress) {
      return c.json({ success: false, error: '缺少 mailboxAddress' }, 400);
    }

    const all = body.all === true;
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : undefined;

    if (!all && (!ids || ids.length === 0)) {
      return c.json({ success: false, error: '请提供 ids 或设置 all: true' }, 400);
    }

    const deleted = await deleteUserMailboxEmails(c.env.DB, user.id, mailboxAddress, { ids, all });
    if (deleted === null) {
      return c.json({ success: false, error: '邮箱不存在或无权操作' }, 404);
    }
    return c.json({ success: true, deleted });
  } catch (error) {
    return c.json(apiInternalError('删除邮件失败', error), 500);
  }
});

app.post('/api/user/emails/:id/re-extract', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;

  try {
    const id = c.req.param('id');
    const access = await requireEmailAccess(c, id, 'mail');
    if (access instanceof Response) return access;

    const email = await reExtractSingleEmail(c.env.DB, id);
    if (!email) {
      return c.json({ success: false, error: '邮件不存在' }, 404);
    }

    return c.json({ success: true, email });
  } catch (error) {
    return c.json(apiInternalError('重新提取验证码失败', error), 500);
  }
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

    const defaultDomain = await resolveDefaultMailDomain(c.env.DB, c.env);
    let mailDomain: string;
    if (body.domain != null && String(body.domain).trim()) {
      const domainCheck = await assertEnabledMailDomain(c.env.DB, c.env, String(body.domain));
      if (!domainCheck.ok) {
        return c.json({ success: false, error: domainCheck.error }, 400);
      }
      mailDomain = domainCheck.domain;
    } else {
      mailDomain = await resolveRandomMailDomain(c.env.DB, c.env);
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
      mailDomain,
    });

    return c.json({
      success: true,
      mailbox: {
        ...mailbox,
        email: formatMailboxEmail(mailbox, defaultDomain),
      },
    });
  } catch (error) {
    return c.json(apiInternalError('创建邮箱失败', error), 400);
  }
});

app.patch('/api/user/mailboxes/:address/domain', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  try {
    const body = await c.req.json();
    const domainRaw = String(body.domain ?? '').trim();
    if (!domainRaw) {
      return c.json({ success: false, error: '缺少 domain 参数' }, 400);
    }
    const domainCheck = await assertEnabledMailDomain(c.env.DB, c.env, domainRaw);
    if (!domainCheck.ok) {
      return c.json({ success: false, error: domainCheck.error }, 400);
    }

    const localPart = parseMailboxAddress(c.req.param('address'));
    const mailbox = await updateMailboxMailDomain(c.env.DB, localPart, user.id, domainCheck.domain);
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在或无权操作' }, 404);
    }

    const defaultDomain = await resolveDefaultMailDomain(c.env.DB, c.env);
    return c.json({
      success: true,
      mailbox: {
        ...mailbox,
        email: formatMailboxEmail(mailbox, defaultDomain),
      },
    });
  } catch (error) {
    return c.json(apiInternalError('更新邮箱域名失败', error), 500);
  }
});

// ─── Web 发信（会话鉴权 + 配额） ─────────────────────────────

app.post('/api/user/send', async (c) => {
  const authErr = await requireUserSession(c);
  if (authErr) return authErr;
  const user = c.get('user')!;

  try {
    const body = await c.req.json();
    if (!body.to || !body.subject) {
      return c.json({ success: false, error: '缺少 to 或 subject 参数' }, 400);
    }
    if (!isValidEmailAddress(String(body.to))) {
      return c.json({ success: false, error: '无效的 to 地址' }, 400);
    }
    if (!body.text && !body.html) {
      return c.json({ success: false, error: '缺少 text 或 html 内容' }, 400);
    }

    const quotaCheck = await checkSendQuota(c.env.DB, user.id, user.dailySendQuota);
    if (!quotaCheck.ok) {
      return c.json({ success: false, error: quotaCheck.error }, 429);
    }

    const allowedDomains = c.get('enabledMailDomains') ?? (await resolveEnabledMailDomainNames(c.env.DB, c.env));
    const fromResult = await resolveOutboundFrom(c.env.DB, c.env, {
      from: body.from,
      mailboxHint: body.address ?? body.mailbox,
      allowedDomains,
      mode: 'user',
      userId: user.id,
    });
    if (!fromResult.ok) {
      return c.json({ success: false, error: fromResult.error }, 400);
    }
    const fromEmail = fromResult.fromEmail;

    const attachmentResult = validateSendAttachments(body.attachments);
    if (!attachmentResult.ok) {
      return c.json({ success: false, error: attachmentResult.error }, 400);
    }

    const result = await sendMail(c.env.DB, c.env, {
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
      from: fromEmail,
      userId: user.id,
      attachments: attachmentResult.attachments,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 502);
    }

    await incrementSendUsage(c.env.DB, user.id);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'user',
        actorId: user.id,
        actorName: user.username,
        action: 'user.send',
        detail: { to: body.to, subject: body.subject, sentEmailId: result.sentEmailId },
        ip: getClientIp(c.req.raw),
      })
    );
    return c.json({ success: true, sentEmailId: result.sentEmailId });
  } catch (error) {
    return c.json(apiInternalError('发送邮件失败', error), 500);
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

  const mailbox = await getMailboxRawById(c.env.DB, email.mailboxId);
  if (!mailbox) {
    return c.json({ success: false, error: '邮箱不存在' }, 404);
  }

  const accessErr = await requireMailboxAuth(c, mailbox, bearerScope);
  if (accessErr) return accessErr;

  // Bearer tokens cannot access expired mailboxes
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ') && mailbox.expiresAt <= getCurrentTimestamp()) {
    return c.json({ success: false, error: '邮箱已过期' }, 403);
  }

  return { email, mailbox };
}

// 租用临时邮箱
app.post('/api/lease', async (c) => {
  const authErr = await requireApiAuth(c, 'lease');
  if (authErr) return authErr;
  const auth = c.get('auth')!;

  try {
    const body = await c.req.json().catch(() => ({}));
    const defaultDomain = await resolveDefaultMailDomain(c.env.DB, c.env);
    let mailDomain: string;
    if (body.domain != null && String(body.domain).trim()) {
      const domainCheck = await assertEnabledMailDomain(c.env.DB, c.env, String(body.domain));
      if (!domainCheck.ok) {
        return c.json({ success: false, error: domainCheck.error }, 400);
      }
      mailDomain = domainCheck.domain;
    } else {
      mailDomain = await resolveRandomMailDomain(c.env.DB, c.env);
    }

    const address = generateRandomAddress();
    const ip = getClientIp(c.req.raw);

    const mailbox = await createMailbox(c.env.DB, {
      address,
      expiresInHours: 24,
      ipAddress: ip,
      userId: auth.type === 'user' ? auth.userId : null,
      mailDomain,
    });

    if (auth.type === 'user' && auth.userId) {
      await incrementLeaseUsage(c.env.DB, auth.userId);
    }

    return c.json({
      success: true,
      email: formatMailboxEmail(mailbox, defaultDomain),
      address: mailbox.address,
      mailDomain: mailbox.mailDomain,
      expiresAt: mailbox.expiresAt,
    });
  } catch (error) {
    return c.json(apiInternalError('租用邮箱失败', error), 500);
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
    return c.json(apiInternalError('轮询邮件失败', error), 500);
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
    if (!isValidEmailAddress(String(body.to))) {
      return c.json({ success: false, error: '无效的 to 地址' }, 400);
    }
    if (!body.text && !body.html) {
      return c.json({ success: false, error: '缺少 text 或 html 内容' }, 400);
    }

    if (auth.type === 'legacy') {
      const ip = getClientIp(c.req.raw);
      const legacyQuota = await getLegacySendDailyQuota(c.env.DB);
      if (legacyQuota >= 0) {
        const legacyLimit = await consumeRateLimit(
          c.env.DB,
          getLegacySendRateLimitKey(ip),
          legacyQuota,
          LEGACY_SEND_WINDOW_MS
        );
        if (!legacyLimit.ok) {
          return c.json(
            { success: false, error: `Legacy Token 每日发信配额已用尽 (${legacyQuota})` },
            429,
            rateLimitHeaders(legacyLimit)
          );
        }
      }
    } else if (auth.type === 'user' && auth.userId != null && auth.dailySendQuota != null) {
      const quotaCheck = await checkSendQuota(c.env.DB, auth.userId, auth.dailySendQuota);
      if (!quotaCheck.ok) {
        return c.json({ success: false, error: quotaCheck.error }, 429);
      }
    }

    const allowedDomains = c.get('enabledMailDomains') ?? (await resolveEnabledMailDomainNames(c.env.DB, c.env));
    const fromMode = auth.type === 'legacy' ? 'legacy' : 'user';
    const fromResult = await resolveOutboundFrom(c.env.DB, c.env, {
      from: body.from,
      mailboxHint: body.address ?? body.mailbox,
      allowedDomains,
      mode: fromMode,
      userId: auth.userId,
      ipAddress: getClientIp(c.req.raw),
    });
    if (!fromResult.ok) {
      return c.json({ success: false, error: fromResult.error }, 400);
    }
    const fromEmail = fromResult.fromEmail;

    const attachmentResult = validateSendAttachments(body.attachments);
    if (!attachmentResult.ok) {
      return c.json({ success: false, error: attachmentResult.error }, 400);
    }

    const result = await sendMail(c.env.DB, c.env, {
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
      from: fromEmail,
      userId: auth.userId ?? null,
      tokenId: auth.tokenId ?? null,
      attachments: attachmentResult.attachments,
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 502);
    }

    if (auth.type === 'user' && auth.userId) {
      await incrementSendUsage(c.env.DB, auth.userId);
    }

    return c.json({ success: true, sentEmailId: result.sentEmailId });
  } catch (error) {
    return c.json(apiInternalError('发送邮件失败', error), 500);
  }
});

// OpenAPI specification (public)
app.get('/openapi.json', (c) => {
  return c.body(getOpenApiJson(), 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  });
});

// Static assets; explicit /docs/ → index.html for CF directory index; strip stray .html on React routes
app.all('*', async (c) => {
  if (!c.env.ASSETS) {
    return c.notFound();
  }

  const url = new URL(c.req.url);
  const { pathname } = url;

  if (pathname === '/docs' || pathname === '/docs/') {
    url.pathname = '/docs/index.html';
    const docHome = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
    if (docHome.status !== 404) {
      return docHome;
    }
  }

  if (pathname === '/api-docs' && !url.searchParams.has('embed')) {
    url.pathname = '/docs/api-interactive.html';
    url.search = '';
    return c.redirect(url.toString(), 301);
  }

  if (
    pathname.endsWith('.html') &&
    !pathname.startsWith('/docs/') &&
    pathname !== '/index.html'
  ) {
    url.pathname = pathname.slice(0, -'.html'.length);
    return c.redirect(url.toString(), 301);
  }

  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);

  // SPA fallback must not serve React index.html for missing VitePress chunks (breaks search/UI)
  if (
    pathname.startsWith('/docs/assets/') &&
    assetResponse.headers.get('Content-Type')?.includes('text/html')
  ) {
    return c.notFound();
  }

  return assetResponse;
});

export default app;
