import { Hono } from 'hono';
import type { Env } from './types';
import {
  getAdminStats,
  listExtractRules,
  listAllUserExtractRules,
  createExtractRule,
  updateGlobalExtractRule,
  deleteGlobalExtractRule,
  deleteAnyUserExtractRule,
  listAdminExtractRuleTemplates,
  approveExtractRuleTemplate,
  rejectExtractRuleTemplate,
  deleteExtractRuleTemplate,
  listSentEmails,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getRateLimitStats,
  getApiRequestStats,
  getLocalEmailStats,
  getMaintenanceMode,
  setMaintenanceMode,
  getRegistrationSettings,
  setRegistrationSettings,
  toAdminRegistrationView,
  getTurnstileSettings,
  setTurnstileSettings,
  toAdminTurnstileView,
  listAuditLogs,
  writeAuditLog,
  listMailDomains,
  createMailDomain,
  updateMailDomain,
  deleteMailDomain,
} from './database';
import { validateExtractRuleInput, validateMailDomainHostname } from './utils';
import { testRunExtractRules } from './extractor';
import { scheduleReExtractAfterRuleChange } from './re-extract';
import {
  isAdminAuthenticated,
  verifyAdminPassword,
  createAdminSessionCookie,
  clearAdminSessionCookie,
  hasAdminCredentials,
} from './auth';
import { getAdminHtml } from './admin';
import { getAdminScript } from './admin-script';
import { adminPathPrefix } from './admin-path';
import {
  consumeRateLimit,
  DEFAULT_GLOBAL_IP_RATE_LIMIT,
  getGlobalIpRateLimitKey,
  rateLimitHeaders,
  rateLimitExceededBody,
  getClientIp,
  consumeLoginAttempt,
  recordLoginFailure,
  clearLoginFailures,
} from './rate-limit';
import { logRateLimitHit, logApiRequestStat } from './monitoring';
import { fetchBrevoAccountIfConfigured } from './brevo-stats';
import { ensureMailDomainsSeeded } from './mail-domains';
import { applySecurityHeaders, resolveAdminCspProfile } from './security-headers';
import { validateRegistrationPassword } from './registration';
import { assertTurnstileIfEnabled } from './turnstile';

async function globalIpRateLimitMiddleware(c: any, next: () => Promise<void>) {
  const rateKey = getGlobalIpRateLimitKey(c.req.header('CF-Connecting-IP'));
  const result = await consumeRateLimit(c.env.DB, rateKey, DEFAULT_GLOBAL_IP_RATE_LIMIT);
  if (!result.ok) {
    c.executionCtx.waitUntil(logRateLimitHit(c.env.DB, c.req.raw, null));
    return c.json(rateLimitExceededBody(), 429, rateLimitHeaders(result));
  }
  for (const [key, value] of Object.entries(rateLimitHeaders(result))) {
    c.header(key, value);
  }
  await next();
}

async function adminRequestStatsMiddleware(c: any, next: () => Promise<void>) {
  await next();
  const status = c.res.status;
  c.executionCtx.waitUntil(logApiRequestStat(c.env.DB, c.req.raw, status));
}

async function requireAdmin(c: any): Promise<Response | null> {
  if (!(await isAdminAuthenticated(c.req.raw, c.env, c.env.DB))) {
    return c.json({ success: false, error: '未授权' }, 401);
  }
  return null;
}

function adminIp(c: any): string {
  return getClientIp(c.req.raw);
}

export function createAdminApp(): Hono<{ Bindings: Env }> {
  const admin = new Hono<{ Bindings: Env }>();

  admin.use('/login', globalIpRateLimitMiddleware);
  admin.use('/logout', globalIpRateLimitMiddleware);
  admin.use('/api/*', globalIpRateLimitMiddleware);
  admin.use('/api/*', adminRequestStatsMiddleware);
  admin.use('*', async (c, next) => {
    await next();
    applySecurityHeaders(c.res.headers, resolveAdminCspProfile(c.req.path, c.res.headers.get('Content-Type')));
  });

  admin.get('/admin.js', (c) => {
    const base = adminPathPrefix(c.env);
    const script = getAdminScript(`${base}/api`, `${base}/login`, `${base}/logout`);
    return c.body(script, 200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'private, no-cache',
    });
  });

  admin.get('/', async (c) => {
    const base = adminPathPrefix(c.env);
    return c.html(getAdminHtml(base));
  });

  admin.post('/login', async (c) => {
    try {
      if (!(await hasAdminCredentials(c.env.DB))) {
        return c.json({ success: false, error: '未配置 ADMIN_PASSWORD' }, 503);
      }
      const ip = adminIp(c);
      const limitCheck = await consumeLoginAttempt(c.env.DB, ip, 'admin-login');
      if (!limitCheck.ok) {
        return c.json(rateLimitExceededBody(limitCheck.locked), 429, rateLimitHeaders(limitCheck));
      }
      const body = await c.req.json();
      const turnstileCheck = await assertTurnstileIfEnabled(c.env.DB, c.env, c.req.raw, body);
      if (!turnstileCheck.ok) {
        return c.json({ success: false, error: turnstileCheck.error }, turnstileCheck.status);
      }
      if (!(await verifyAdminPassword(c.env.DB, body.password))) {
        await recordLoginFailure(c.env.DB, ip, 'admin-login');
        return c.json({ success: false, error: '密码错误' }, 401);
      }
      await clearLoginFailures(c.env.DB, ip, 'admin-login');
      const cookie = await createAdminSessionCookie(c.env, c.env.DB, c.req.raw);
      if (!cookie) {
        return c.json({ success: false, error: '未配置 SESSION_SECRET' }, 503);
      }
      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          actorType: 'admin',
          actorName: 'admin',
          action: 'admin.login',
          ip: adminIp(c),
        })
      );
      return c.json({ success: true }, 200, { 'Set-Cookie': cookie });
    } catch {
      return c.json({ success: false, error: '登录失败' }, 500);
    }
  });

  admin.post('/logout', (c) => {
    return c.json({ success: true }, 200, { 'Set-Cookie': clearAdminSessionCookie(c.env, c.req.raw) });
  });

  admin.get('/api/stats', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const stats = await getAdminStats(c.env.DB);
    return c.json({ success: true, stats });
  });

  admin.get('/api/rate-limit-stats', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const stats = await getRateLimitStats(c.env.DB);
    return c.json({ success: true, stats });
  });

  admin.get('/api/request-stats', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const stats = await getApiRequestStats(c.env.DB);
    return c.json({ success: true, stats });
  });

  admin.get('/api/brevo-stats', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const local = await getLocalEmailStats(c.env.DB);
    const brevoResult = await fetchBrevoAccountIfConfigured(c.env);
    if (brevoResult === null) {
      return c.json({
        success: true,
        stats: { local, brevo: null, brevoAvailable: false, brevoError: '未配置 BREVO_API_KEY' },
      });
    }
    if (!brevoResult.ok) {
      return c.json({
        success: true,
        stats: { local, brevo: null, brevoAvailable: false, brevoError: brevoResult.error },
      });
    }
    return c.json({
      success: true,
      stats: { local, brevo: brevoResult.summary, brevoAvailable: true },
    });
  });

  admin.get('/api/maintenance', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const [maintenance, turnstile] = await Promise.all([
      getMaintenanceMode(c.env.DB),
      getTurnstileSettings(c.env.DB),
    ]);
    return c.json({
      success: true,
      maintenance,
      turnstile: toAdminTurnstileView(turnstile),
    });
  });

  admin.put('/api/maintenance', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();
    const maintenance = await setMaintenanceMode(c.env.DB, {
      enabled: !!body.enabled,
      message: String(body.message ?? ''),
      blockLease: body.blockLease !== false,
      blockSend: body.blockSend !== false,
      blockMailboxCreate: body.blockMailboxCreate !== false,
    });
    let turnstile = await getTurnstileSettings(c.env.DB);
    if (body.turnstile && typeof body.turnstile === 'object') {
      const t = body.turnstile as Record<string, unknown>;
      turnstile = await setTurnstileSettings(c.env.DB, {
        enabled: t.enabled !== undefined ? !!t.enabled : undefined,
        siteKey: t.siteKey != null ? String(t.siteKey) : undefined,
        secretKey: t.secretKey != null ? String(t.secretKey) : undefined,
      });
    }
    const detail: Record<string, unknown> = {
      ...(maintenance as unknown as Record<string, unknown>),
      turnstile: toAdminTurnstileView(turnstile),
    };
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'maintenance.update',
        detail,
        ip: adminIp(c),
      })
    );
    return c.json({
      success: true,
      maintenance,
      turnstile: toAdminTurnstileView(turnstile),
    });
  });

  admin.get('/api/registration', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const registration = await getRegistrationSettings(c.env.DB);
    return c.json({ success: true, registration: toAdminRegistrationView(registration) });
  });

  admin.put('/api/registration', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();
    const registration = await setRegistrationSettings(c.env.DB, {
      enabled: !!body.enabled,
    });
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'registration.update',
        detail: { enabled: registration.enabled },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, registration: toAdminRegistrationView(registration) });
  });

  admin.get('/api/audit-logs', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const fromRaw = c.req.query('from');
    const toRaw = c.req.query('to');
    const from = fromRaw ? parseInt(fromRaw, 10) : undefined;
    const to = toRaw ? parseInt(toRaw, 10) : undefined;
    const result = await listAuditLogs(c.env.DB, { page, limit, from, to });
    return c.json({ success: true, ...result });
  });

  admin.get('/api/rules', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const rules = await listExtractRules(c.env.DB);
    const userRules = await listAllUserExtractRules(c.env.DB);
    return c.json({ success: true, rules, userRules });
  });

  admin.post('/api/rules', async (c) => {
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
      remark: body.remark,
    });
    scheduleReExtractAfterRuleChange(c.executionCtx, c.env.DB, {
      domain: rule.domain,
      enabled: rule.enabled,
    });
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'rule.create',
        detail: { ruleId: rule.id, domain: rule.domain },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, rule });
  });

  admin.put('/api/rules/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const ruleId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const validated = validateExtractRuleInput(body);
    if (!validated.ok) return c.json({ success: false, error: validated.error }, 400);
    const rule = await updateGlobalExtractRule(c.env.DB, ruleId, {
      domain: validated.domain,
      regex: validated.regex,
      priority: body.priority,
      enabled: body.enabled,
      remark: body.remark,
    });
    if (!rule) return c.json({ success: false, error: '规则不存在' }, 404);
    scheduleReExtractAfterRuleChange(c.executionCtx, c.env.DB, {
      domain: rule.domain,
      enabled: rule.enabled,
    });
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'rule.update',
        detail: { ruleId: rule.id, domain: rule.domain },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, rule });
  });

  admin.delete('/api/rules/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const ruleId = parseInt(c.req.param('id'), 10);
    const ok = await deleteGlobalExtractRule(c.env.DB, ruleId);
    if (!ok) return c.json({ success: false, error: '规则不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'rule.delete',
        detail: { ruleId },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true });
  });

  admin.delete('/api/rules/user/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const ruleId = parseInt(c.req.param('id'), 10);
    const ok = await deleteAnyUserExtractRule(c.env.DB, ruleId);
    if (!ok) return c.json({ success: false, error: '规则不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'rule.user.delete',
        detail: { ruleId },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true });
  });

  admin.post('/api/extract-rules/test-run', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();
    const fromAddress = String(body.fromAddress ?? '').trim();
    const subject = String(body.subject ?? '');
    const text = String(body.text ?? '');
    if (!fromAddress) {
      return c.json({ success: false, error: 'fromAddress 必填' }, 400);
    }
    const userId =
      body.userId !== undefined && body.userId !== null && body.userId !== ''
        ? parseInt(String(body.userId), 10)
        : null;
    if (userId != null && Number.isNaN(userId)) {
      return c.json({ success: false, error: 'userId 无效' }, 400);
    }
    const result = await testRunExtractRules(c.env.DB, fromAddress, subject, text, userId);
    return c.json({ success: true, ...result });
  });

  admin.get('/api/extract-rule-templates', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const status = (c.req.query('status') || 'all') as 'pending' | 'approved' | 'rejected' | 'all';
    const templates = await listAdminExtractRuleTemplates(c.env.DB, status);
    return c.json({ success: true, templates });
  });

  admin.post('/api/extract-rule-templates/:id/approve', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const id = parseInt(c.req.param('id'), 10);
    const template = await approveExtractRuleTemplate(c.env.DB, id);
    if (!template) return c.json({ success: false, error: '模板不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'extract_rule_template.approve',
        detail: { templateId: template.id, domain: template.domain, title: template.title },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, template });
  });

  admin.post('/api/extract-rule-templates/:id/reject', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json().catch(() => ({}));
    const reason = String((body as { reason?: string }).reason ?? '').trim();
    const template = await rejectExtractRuleTemplate(c.env.DB, id, reason || '未通过审核');
    if (!template) return c.json({ success: false, error: '模板不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'extract_rule_template.reject',
        detail: { templateId: template.id, reason: template.rejectReason },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, template });
  });

  admin.delete('/api/extract-rule-templates/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const id = parseInt(c.req.param('id'), 10);
    const ok = await deleteExtractRuleTemplate(c.env.DB, id);
    if (!ok) return c.json({ success: false, error: '模板不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'extract_rule_template.delete',
        detail: { templateId: id },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true });
  });

  admin.get('/api/sent-emails', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const emails = await listSentEmails(c.env.DB);
    return c.json({ success: true, emails });
  });

  admin.get('/api/users', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const users = await listUsers(c.env.DB);
    return c.json({ success: true, users });
  });

  admin.post('/api/users', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();
    if (!body.username || !body.password) {
      return c.json({ success: false, error: '缺少 username 或 password' }, 400);
    }
    const passwordError = validateRegistrationPassword(String(body.password));
    if (passwordError) {
      return c.json({ success: false, error: passwordError }, 400);
    }
    try {
      const user = await createUser(c.env.DB, {
        username: String(body.username),
        password: String(body.password),
        role: body.role === 'admin' ? 'admin' : 'user',
        dailySendQuota: parseInt(body.dailySendQuota) || 50,
        dailyLeaseQuota:
          body.dailyLeaseQuota !== undefined && body.dailyLeaseQuota !== ''
            ? parseInt(body.dailyLeaseQuota)
            : undefined,
        rateLimitPerMin: body.rateLimitPerMin !== undefined ? parseInt(body.rateLimitPerMin) || 60 : undefined,
        rateLimitBurst:
          body.rateLimitBurst !== undefined && body.rateLimitBurst !== '' && body.rateLimitBurst != null
            ? parseInt(body.rateLimitBurst) || null
            : undefined,
        maxUserTokens:
          body.maxUserTokens !== undefined && body.maxUserTokens !== ''
            ? parseInt(String(body.maxUserTokens), 10)
            : undefined,
      });
      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          actorType: 'admin',
          actorName: 'admin',
          action: 'user.create',
          detail: {
            userId: user.id,
            username: user.username,
            rateLimitPerMin: user.rateLimitPerMin,
            rateLimitBurst: user.rateLimitBurst,
          },
          ip: adminIp(c),
        })
      );
      return c.json({ success: true, user });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('UNIQUE')) {
        return c.json({ success: false, error: '用户名已存在' }, 400);
      }
      return c.json({ success: false, error: '创建用户失败' }, 500);
    }
  });

  admin.put('/api/users/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const userId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    if (body.password) {
      const passwordError = validateRegistrationPassword(String(body.password));
      if (passwordError) {
        return c.json({ success: false, error: passwordError }, 400);
      }
    }
    const user = await updateUser(c.env.DB, userId, {
      role: body.role !== undefined ? (body.role === 'admin' ? 'admin' : 'user') : undefined,
      dailySendQuota: body.dailySendQuota !== undefined ? parseInt(body.dailySendQuota) : undefined,
      dailyLeaseQuota:
        body.dailyLeaseQuota !== undefined && body.dailyLeaseQuota !== ''
          ? parseInt(body.dailyLeaseQuota)
          : undefined,
      rateLimitPerMin: body.rateLimitPerMin !== undefined ? parseInt(body.rateLimitPerMin) || 60 : undefined,
      rateLimitBurst:
        body.rateLimitBurst !== undefined
          ? body.rateLimitBurst === '' || body.rateLimitBurst == null
            ? null
            : parseInt(body.rateLimitBurst) || null
          : undefined,
      enabled: body.enabled,
      password: body.password || undefined,
      maxUserTokens:
        body.maxUserTokens !== undefined && body.maxUserTokens !== ''
          ? parseInt(String(body.maxUserTokens), 10)
          : undefined,
    });
    if (!user) return c.json({ success: false, error: '用户不存在' }, 404);
    const detail: Record<string, unknown> = { userId: user.id, username: user.username };
    if (body.rateLimitPerMin !== undefined || body.rateLimitBurst !== undefined) {
      detail.rateLimitPerMin = user.rateLimitPerMin;
      detail.rateLimitBurst = user.rateLimitBurst;
      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          actorType: 'admin',
          actorName: 'admin',
          action: 'user.rate_limit.update',
          detail,
          ip: adminIp(c),
        })
      );
    }
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'user.update',
        detail,
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, user });
  });

  admin.delete('/api/users/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const userId = parseInt(c.req.param('id'), 10);
    const ok = await deleteUser(c.env.DB, userId);
    if (!ok) return c.json({ success: false, error: '用户不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'user.delete',
        detail: { userId },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true });
  });

  admin.get('/api/announcements', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const announcements = await listAnnouncements(c.env.DB);
    return c.json({ success: true, announcements });
  });

  admin.post('/api/announcements', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();
    const title = String(body.title ?? '').trim();
    const content = String(body.content ?? '').trim();
    if (!title || !content) {
      return c.json({ success: false, error: '标题和内容不能为空' }, 400);
    }
    const announcement = await createAnnouncement(c.env.DB, {
      title,
      content,
      enabled: body.enabled,
      createdBy: body.createdBy ?? null,
    });
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'announcement.create',
        detail: { announcementId: announcement.id, title: announcement.title },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, announcement });
  });

  admin.put('/api/announcements/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const announcementId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const title = String(body.title ?? '').trim();
    const content = String(body.content ?? '').trim();
    if (!title || !content) {
      return c.json({ success: false, error: '标题和内容不能为空' }, 400);
    }
    const announcement = await updateAnnouncement(c.env.DB, announcementId, {
      title,
      content,
      enabled: body.enabled,
    });
    if (!announcement) return c.json({ success: false, error: '公告不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'announcement.update',
        detail: { announcementId: announcement.id, title: announcement.title },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, announcement });
  });

  admin.delete('/api/announcements/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const announcementId = parseInt(c.req.param('id'), 10);
    const ok = await deleteAnnouncement(c.env.DB, announcementId);
    if (!ok) return c.json({ success: false, error: '公告不存在' }, 404);
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'announcement.delete',
        detail: { announcementId },
        ip: adminIp(c),
      })
    );
    return c.json({ success: true });
  });

  admin.get('/api/domains', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    await ensureMailDomainsSeeded(c.env.DB, c.env);
    const domains = await listMailDomains(c.env.DB);
    return c.json({
      success: true,
      domains,
      brevoConfigured: !!c.env.BREVO_API_KEY,
    });
  });

  admin.post('/api/domains', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();

    if (!c.env.BREVO_API_KEY) {
      return c.json(
        { success: false, error: '请先在 Worker 环境变量中配置 BREVO_API_KEY' },
        400
      );
    }
    if (!body.cloudflareReady || !body.brevoVerified) {
      return c.json(
        {
          success: false,
          error: '添加域名前须确认已在 Cloudflare 接入 zMailR（Email Routing）且已在 Brevo 完成发信域名认证',
        },
        400
      );
    }

    const validated = validateMailDomainHostname(String(body.domain ?? ''));
    if (!validated.ok) {
      return c.json({ success: false, error: validated.error }, 400);
    }

    try {
      const domain = await createMailDomain(c.env.DB, {
        domain: validated.domain,
        enabled: body.enabled !== false,
        cloudflareReady: true,
        brevoVerified: true,
        isDefault: !!body.isDefault,
      });
      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          actorType: 'admin',
          actorName: 'admin',
          action: 'domain.create',
          detail: { domainId: domain.id, domain: domain.domain },
          ip: adminIp(c),
        })
      );
      return c.json({ success: true, domain });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('UNIQUE')) {
        return c.json({ success: false, error: '该域名已存在' }, 400);
      }
      return c.json({ success: false, error: msg || '添加域名失败' }, 500);
    }
  });

  admin.put('/api/domains/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const domainId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    try {
      const domain = await updateMailDomain(c.env.DB, domainId, {
        enabled: body.enabled,
        isDefault: body.isDefault,
        cloudflareReady: body.cloudflareReady,
        brevoVerified: body.brevoVerified,
        sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : undefined,
      });
      if (!domain) return c.json({ success: false, error: '域名不存在' }, 404);
      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          actorType: 'admin',
          actorName: 'admin',
          action: 'domain.update',
          detail: {
            domainId: domain.id,
            domain: domain.domain,
            enabled: domain.enabled,
            isDefault: domain.isDefault,
          },
          ip: adminIp(c),
        })
      );
      return c.json({ success: true, domain });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg || '更新域名失败' }, 400);
    }
  });

  admin.delete('/api/domains/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const domainId = parseInt(c.req.param('id'), 10);

    try {
      const existing = await listMailDomains(c.env.DB);
      const target = existing.find((d) => d.id === domainId);
      const ok = await deleteMailDomain(c.env.DB, domainId);
      if (!ok) return c.json({ success: false, error: '域名不存在' }, 404);
      c.executionCtx.waitUntil(
        writeAuditLog(c.env.DB, {
          actorType: 'admin',
          actorName: 'admin',
          action: 'domain.delete',
          detail: { domainId, domain: target?.domain },
          ip: adminIp(c),
        })
      );
      return c.json({ success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return c.json({ success: false, error: msg || '删除域名失败' }, 400);
    }
  });

  return admin;
}
