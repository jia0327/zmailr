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
} from './rate-limit';

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

async function requireAdmin(c: any): Promise<Response | null> {
  if (!(await isAdminAuthenticated(c.req.raw, c.env))) {
    return c.json({ success: false, error: '未授权' }, 401);
  }
  return null;
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
    return c.json({ success: true, rule });
  });

  admin.put('/api/rules/:id', async (c) => {
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
      remark: body.remark,
    });
    if (!rule) return c.json({ success: false, error: '规则不存在' }, 404);
    return c.json({ success: true, rule });
  });

  admin.delete('/api/rules/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const ok = await deleteGlobalExtractRule(c.env.DB, parseInt(c.req.param('id'), 10));
    if (!ok) return c.json({ success: false, error: '规则不存在' }, 404);
    return c.json({ success: true });
  });

  admin.delete('/api/rules/user/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const ok = await deleteAnyUserExtractRule(c.env.DB, parseInt(c.req.param('id'), 10));
    if (!ok) return c.json({ success: false, error: '规则不存在' }, 404);
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

  admin.put('/api/users/:id', async (c) => {
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

  admin.delete('/api/users/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const ok = await deleteUser(c.env.DB, parseInt(c.req.param('id'), 10));
    if (!ok) return c.json({ success: false, error: '用户不存在' }, 404);
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
    return c.json({ success: true, announcement });
  });

  admin.put('/api/announcements/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const body = await c.req.json();
    const title = String(body.title ?? '').trim();
    const content = String(body.content ?? '').trim();
    if (!title || !content) {
      return c.json({ success: false, error: '标题和内容不能为空' }, 400);
    }
    const announcement = await updateAnnouncement(c.env.DB, parseInt(c.req.param('id'), 10), {
      title,
      content,
      enabled: body.enabled,
    });
    if (!announcement) return c.json({ success: false, error: '公告不存在' }, 404);
    return c.json({ success: true, announcement });
  });

  admin.delete('/api/announcements/:id', async (c) => {
    const authErr = await requireAdmin(c);
    if (authErr) return authErr;
    const ok = await deleteAnnouncement(c.env.DB, parseInt(c.req.param('id'), 10));
    if (!ok) return c.json({ success: false, error: '公告不存在' }, 404);
    return c.json({ success: true });
  });

  return admin;
}
