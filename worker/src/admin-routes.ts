import { Hono } from 'hono';
import type { Env } from './types';
import {
  getAdminStats,
  listApiTokens,
  createApiToken,
  deleteApiToken,
  listExtractRules,
  listAllUserExtractRules,
  createExtractRule,
  updateGlobalExtractRule,
  deleteGlobalExtractRule,
  deleteAnyUserExtractRule,
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
  getLocalEmailStats,
  getMaintenanceMode,
  setMaintenanceMode,
  listAuditLogs,
  writeAuditLog,
} from './database';
import { validateExtractRuleInput } from './utils';
import {
  isAdminAuthenticated,
  verifyAdminPassword,
  createAdminSessionCookie,
  clearAdminSessionCookie,
} from './auth';
import { getAdminHtml } from './admin';
import { adminPathPrefix } from './admin-path';
import {
  consumeRateLimit,
  DEFAULT_GLOBAL_IP_RATE_LIMIT,
  getGlobalIpRateLimitKey,
  rateLimitHeaders,
  rateLimitExceededBody,
  getClientIp,
} from './rate-limit';
import { logRateLimitHit } from './monitoring';
import { fetchBrevoAccountIfConfigured } from './brevo-stats';

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

async function requireAdmin(c: any): Promise<Response | null> {
  if (!(await isAdminAuthenticated(c.req.raw, c.env))) {
    return c.json({ success: false, error: '未授权' }, 401);
  }
  return null;
}

function adminIp(c: any): string {
  return getClientIp(c.req.raw);
}

export function createAdminApp(): Hono<{ Bindings: Env }> {
  const admin = new Hono<{ Bindings: Env }>();

  admin.use('/api/*', globalIpRateLimitMiddleware);

  admin.get('/', async (c) => {
    const base = adminPathPrefix(c.env);
    return c.html(getAdminHtml(base));
  });

  admin.post('/login', async (c) => {
    try {
      if (!c.env.ADMIN_PASSWORD) {
        return c.json({ success: false, error: '未配置 ADMIN_PASSWORD' }, 503);
      }
      const body = await c.req.json();
      if (!verifyAdminPassword(c.env, body.password)) {
        return c.json({ success: false, error: '密码错误' }, 401);
      }
      const cookie = await createAdminSessionCookie(c.env);
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
    return c.json({ success: true }, 200, { 'Set-Cookie': clearAdminSessionCookie(c.env) });
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
    const maintenance = await getMaintenanceMode(c.env.DB);
    return c.json({ success: true, maintenance });
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
    c.executionCtx.waitUntil(
      writeAuditLog(c.env.DB, {
        actorType: 'admin',
        actorName: 'admin',
        action: 'maintenance.update',
        detail: maintenance as unknown as Record<string, unknown>,
        ip: adminIp(c),
      })
    );
    return c.json({ success: true, maintenance });
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

  admin.get('/api/tokens', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const tokens = await listApiTokens(c.env.DB);
    return c.json({ success: true, tokens });
  });

  admin.post('/api/tokens', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();
    const expiresInDays = Math.min(Math.max(parseInt(body.expiresInDays) || 30, 1), 365);
    const token = await createApiToken(c.env.DB, { name: body.name, expiresInDays });
    return c.json({ success: true, token });
  });

  admin.delete('/api/tokens/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    await deleteApiToken(c.env.DB, parseInt(c.req.param('id'), 10));
    return c.json({ success: true });
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
    try {
      const user = await createUser(c.env.DB, {
        username: String(body.username),
        password: String(body.password),
        role: body.role === 'admin' ? 'admin' : 'user',
        dailySendQuota: parseInt(body.dailySendQuota) || 50,
        rateLimitPerMin: body.rateLimitPerMin !== undefined ? parseInt(body.rateLimitPerMin) || 60 : undefined,
        rateLimitBurst:
          body.rateLimitBurst !== undefined && body.rateLimitBurst !== '' && body.rateLimitBurst != null
            ? parseInt(body.rateLimitBurst) || null
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
    const user = await updateUser(c.env.DB, userId, {
      role: body.role,
      dailySendQuota: body.dailySendQuota !== undefined ? parseInt(body.dailySendQuota) : undefined,
      rateLimitPerMin: body.rateLimitPerMin !== undefined ? parseInt(body.rateLimitPerMin) || 60 : undefined,
      rateLimitBurst:
        body.rateLimitBurst !== undefined
          ? body.rateLimitBurst === '' || body.rateLimitBurst == null
            ? null
            : parseInt(body.rateLimitBurst) || null
          : undefined,
      enabled: body.enabled,
      password: body.password || undefined,
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

  return admin;
}
