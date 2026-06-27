/**
 * Capture documentation screenshots from live zMailR demo.
 *
 * Usage:
 *   ADMIN_PATH=/secret ADMIN_PASSWORD=xxx node scripts/capture-screenshots.mjs
 *
 * Optional env:
 *   ZMAILR_BASE_URL, SCREENSHOT_DIR, HEADLESS=false,
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, USER_USERNAME, USER_PASSWORD
 */
import { chromium } from 'playwright';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.SCREENSHOT_DIR
  ? path.resolve(process.env.SCREENSHOT_DIR)
  : path.resolve(__dirname, '../docs/screenshots');
const BASE = process.env.ZMAILR_BASE_URL || 'https://zmailr.onlydev.ccwu.cc';
const ADMIN_PATH = process.env.ADMIN_PATH || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const USER_USERNAME = process.env.USER_USERNAME || 'guest';
const USER_PASSWORD = process.env.USER_PASSWORD || 'guest';
const VIEWPORT = { width: 1280, height: 900 };
const OTP_CODE = '847291';
const BROWSER_EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || null;
const SHOT_DELAY_MS = Number(process.env.SHOT_DELAY_MS || 2000);

const results = [];
const skipped = [];

function log(name, note) {
  results.push({ name, note });
  console.log(`✓ ${name}: ${note}`);
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function clearScreenshots() {
  if (process.env.SKIP_CLEAR === '1') return;
  await mkdir(OUT_DIR, { recursive: true });
  const files = await readdir(OUT_DIR);
  for (const f of files) {
    if (f.endsWith('.png')) await unlink(path.join(OUT_DIR, f));
  }
  console.log(`Cleared ${files.filter((f) => f.endsWith('.png')).length} old PNG files`);
}

async function shot(page, filename, note, opts = {}) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await wait(SHOT_DELAY_MS);
  const filePath = path.join(OUT_DIR, filename);
  await page.screenshot({ path: filePath, fullPage: true, ...opts });
  log(filename, note);
}

async function gotoReady(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(t);
  }, theme);
}

async function capturePublicPages(context) {
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);

  await gotoReady(page, `${BASE}/`);
  await shot(page, 'landing.png', 'Marketing landing page /');

  await gotoReady(page, `${BASE}/login`);
  await shot(page, 'login-empty.png', 'Login page before credentials');

  await page.locator('input[autocomplete="username"]').fill(USER_USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(USER_PASSWORD);
  await shot(page, 'login.png', 'Login page with credentials filled');

  await gotoReady(page, `${BASE}/register`);
  await shot(page, 'register.png', 'User registration page');

  await gotoReady(page, `${BASE}/forgot-password`);
  await shot(page, 'forgot-password.png', 'Forgot password page');

  await page.close();
}

async function login(page) {
  await gotoReady(page, `${BASE}/login`);
  await page.locator('input[autocomplete="username"]').fill(USER_USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(USER_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard/**', { timeout: 60000 });
  await wait(SHOT_DELAY_MS);
}

async function readStoredApiToken(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('zmail_api_tokens');
    if (!raw) return null;
    const store = JSON.parse(raw);
    for (const userKey of Object.keys(store)) {
      for (const token of Object.values(store[userKey] ?? {})) {
        if (typeof token === 'string' && token.length > 8) return token;
      }
    }
    return null;
  });
}

async function waitForInboxReady(page) {
  await gotoReady(page, `${BASE}/dashboard/inbox`);
  await page.locator('.max-w-5xl').waitFor({ state: 'visible', timeout: 60000 });
  await page
    .locator('.flex.justify-center.items-center.min-h-\\[40vh\\] .animate-spin')
    .waitFor({ state: 'hidden', timeout: 60000 })
    .catch(() => {});
  await page
    .getByRole('button', { name: /新建收件箱|New Inbox/i })
    .waitFor({ state: 'visible', timeout: 60000 });
}

async function createMailbox(page) {
  await waitForInboxReady(page);
  await page.getByRole('button', { name: /新建收件箱|New Inbox/i }).click();
  await page
    .locator('text=/邮箱为空|Inbox is empty|等待接收/i')
    .waitFor({ state: 'visible', timeout: 60000 })
    .catch(() => wait(2500));
}

async function getActiveMailboxEmail(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('tempMailbox');
    if (raw) {
      try {
        const mb = JSON.parse(raw);
        if (mb.address?.includes('@')) return mb.address;
        const domain =
          document.querySelector('.font-mono select')?.value ||
          document.querySelector('select.appearance-none')?.value;
        if (mb.address && domain) return `${mb.address}@${domain}`;
      } catch {
        /* fall through */
      }
    }
    const mono = document.querySelector('.font-mono.select-all, .font-mono.text-base');
    const text = mono?.textContent?.replace(/\s+/g, '') ?? '';
    if (text.includes('@')) return text;
    return null;
  });
}

async function sendOtpViaApi(page, apiToken, toEmail) {
  const res = await page.request.post(`${BASE}/api/send`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      to: toEmail,
      subject: '您的验证码',
      text: `验证码是：${OTP_CODE}`,
    },
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(`POST /api/send failed: ${JSON.stringify(body)}`);
  }
  console.log(`Sent OTP test mail to ${toEmail}`);
}

async function pollOtpViaApi(page, apiToken, toEmail, timeoutSec = 55) {
  const res = await page.request.get(
    `${BASE}/api/mail?to=${encodeURIComponent(toEmail)}&timeout=${timeoutSec}`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: (timeoutSec + 15) * 1000,
    }
  );
  const body = await res.json();
  if (body.success && body.code === OTP_CODE) return true;
  console.warn('API poll result:', body);
  return false;
}

async function waitForOtpInUi(page, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await page.locator(`text=${OTP_CODE}`).count()) return true;
    const refreshBtn = page.locator('button[title*="刷新"], button[title*="Refresh"]').first();
    if (await refreshBtn.count()) {
      await refreshBtn.click();
      await wait(2500);
    } else {
      await page.reload({ waitUntil: 'networkidle' });
      await wait(1500);
    }
  }
  return false;
}

async function ensureApiToken(page, state) {
  if (state.apiToken) return state.apiToken;

  state.apiToken = await readStoredApiToken(page);
  if (state.apiToken) return state.apiToken;

  state.apiToken = await page.evaluate(() => {
    const codes = [...document.querySelectorAll('code.font-mono')];
    for (const el of codes) {
      const text = el.textContent?.trim();
      if (text?.startsWith('zmr_') && text.length > 12) return text;
    }
    return null;
  });
  if (state.apiToken) return state.apiToken;

  state.apiToken = await page.evaluate(async () => {
    const listRes = await fetch('/api/user/tokens', { credentials: 'include' });
    const list = await listRes.json();
    if (list.tokens?.length) {
      await fetch(`/api/user/tokens/${list.tokens[0].id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    }
    const createRes = await fetch('/api/user/tokens', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInDays: 30, scopes: ['lease', 'mail', 'send'] }),
    });
    const data = await createRes.json();
    return data.token?.token ?? null;
  });

  return state.apiToken;
}

async function captureDashboardUsage(page) {
  await gotoReady(page, `${BASE}/dashboard/usage`);
  await setTheme(page, 'dark');
  await shot(page, 'dashboard.png', 'Dashboard usage /dashboard/usage');
}

async function captureApiKeys(page, state) {
  await gotoReady(page, `${BASE}/dashboard/api-keys`);
  await page
    .locator('h2')
    .filter({ hasText: /API Token|API 密钥/i })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });

  const recreateBtn = page.getByRole('button', { name: /删除并重新创建以复制|Recreate to copy/i });
  const createHeaderBtn = page.getByRole('button', { name: /创建 Token|Create Token/i });

  if (await recreateBtn.count()) {
    page.once('dialog', (d) => d.accept());
    await recreateBtn.first().click();
    await page
      .locator('code.font-mono')
      .filter({ hasText: /^zmr_/ })
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
  } else if (await createHeaderBtn.count()) {
    await createHeaderBtn.click();
    await page.locator('form').filter({ has: page.locator('#token-expires-days') }).waitFor({
      state: 'visible',
      timeout: 15000,
    });
    await page.locator('form button[type="submit"]').click();
    await page
      .locator('code.font-mono')
      .filter({ hasText: /^zmr_/ })
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
  } else {
    await ensureApiToken(page, state);
  }

  await ensureApiToken(page, state);
  await shot(page, 'api-keys-create.png', 'API keys page with token visible');
}

async function captureInboxNewMailbox(page, state) {
  await createMailbox(page);
  state.otpMailboxEmail = await getActiveMailboxEmail(page);
  await shot(page, 'inbox-new-mailbox.png', 'Inbox after creating new mailbox');
}

async function captureInboxWithOtp(page, state) {
  await ensureApiToken(page, state);
  const email = state.otpMailboxEmail || (await getActiveMailboxEmail(page));
  if (!email) throw new Error('Could not read mailbox email for OTP test');
  if (!state.apiToken) throw new Error('No API token available for OTP test');

  await sendOtpViaApi(page, state.apiToken, email);
  const apiOk = await pollOtpViaApi(page, state.apiToken, email);
  if (!apiOk) throw new Error('OTP did not arrive via /api/mail poll');

  await waitForInboxReady(page);
  await wait(1000);

  const found = await waitForOtpInUi(page);
  if (!found) throw new Error('OTP did not appear in inbox UI within timeout');

  await shot(page, 'inbox-with-otp.png', `Full inbox page with OTP ${OTP_CODE} highlighted`);
}

async function captureInboxHistory(page) {
  for (let i = 0; i < 3; i++) {
    await createMailbox(page);
  }

  const historySection = page
    .locator('.border.rounded-lg')
    .filter({ has: page.getByText(/邮箱历史|Mailbox History|mailboxList/i) });
  await historySection.scrollIntoViewIfNeeded();
  await wait(500);

  const nextBtn = historySection.getByRole('button', { name: /下一页|Next/i });
  if (await nextBtn.count() && !(await nextBtn.isDisabled())) {
    await nextBtn.click();
    await wait(600);
  }

  await shot(page, 'inbox.png', 'Full inbox page with mailbox history pagination');
}

async function captureOutbox(page) {
  await gotoReady(page, `${BASE}/dashboard/outbox`);
  await setTheme(page, 'light');

  await page.getByRole('button', { name: /纯文本|Plain/i }).first().click();
  await wait(400);
  await shot(page, 'outbox-send.png', 'Outbox plain text compose tab');

  await page
    .locator('.flex.rounded-md.border.overflow-hidden.text-xs button')
    .filter({ hasText: /富文本|Rich/i })
    .click();
  await wait(600);
  const subjectInput = page.locator('label').filter({ hasText: /主题|Subject/i }).locator('..').locator('input');
  await subjectInput.fill('富文本 E2E 截图');
  const editor = page.locator('.ql-editor');
  if (await editor.count()) {
    await editor.click();
    await editor.fill('这是富文本编辑器演示内容，用于文档截图。\n支持加粗、链接等格式。');
  }
  await wait(500);
  await shot(page, 'outbox-rich-text.png', 'Outbox rich text tab with demo content');

  const sentList = page.locator('.border.rounded-lg').filter({ has: page.getByText(/已发送|Sent/i) }).last();
  await sentList.scrollIntoViewIfNeeded();
  await wait(400);
  await shot(page, 'outbox-sent.png', 'Full outbox page showing sent list');

  const firstRow = sentList.locator('.cursor-pointer, .divide-y > div').first();
  if (await firstRow.count()) {
    await firstRow.click();
    await wait(800);
    await shot(page, 'outbox-sent-detail.png', 'Outbox with sent detail modal open');
    await page.keyboard.press('Escape');
  } else {
    skipped.push('outbox-sent-detail.png — no sent emails to open');
  }
}

async function captureExtractRules(page) {
  await gotoReady(page, `${BASE}/dashboard/extract-rules`);
  await setTheme(page, 'dark');
  await page.locator('.max-w-4xl').waitFor({ state: 'visible', timeout: 30000 });
  const addBtn = page.getByRole('button', { name: /新增规则|Add Rule/i });
  await addBtn.waitFor({ state: 'visible', timeout: 30000 });
  await addBtn.click();
  await page.locator('#rule-domain').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#rule-domain').fill('example.com');
  await page.locator('#rule-regex').fill('(?:code|验证码)[：:\\s]*(\\d{4,8})');
  await shot(page, 'extract-rules-custom.png', 'Extract rules with add-rule form open');
}

async function captureApiDebug(page) {
  await gotoReady(page, `${BASE}/dashboard/api-debug`);
  await page.locator('#endpoint-select').selectOption('user-quota');
  await wait(400);
  await page.getByRole('button', { name: /发送请求/i }).click();
  await shot(page, 'api-debug-response.png', 'API debug with GET /api/user/quota response');
}

async function captureDocs(context) {
  const docsPage = await context.newPage();
  await docsPage.setViewportSize(VIEWPORT);

  await gotoReady(docsPage, `${BASE}/docs/`);
  await shot(docsPage, 'docs-home.png', 'VitePress docs home at /docs/');

  await gotoReady(docsPage, `${BASE}/api-docs`);
  await shot(docsPage, 'api-interactive.png', 'Interactive API docs at /api-docs');

  await docsPage.close();
}

async function adminSwitchTab(page, tabName) {
  await page.locator(`.tab[data-tab="${tabName}"]`).click();
  await page.locator(`#panel-${tabName}.active`).waitFor({ state: 'visible', timeout: 15000 });
  await wait(SHOT_DELAY_MS);
}

async function captureAdmin(context) {
  if (!ADMIN_PATH || !ADMIN_PASSWORD) {
    skipped.push('All admin screenshots — set ADMIN_PATH and ADMIN_PASSWORD env vars');
    return;
  }

  const adminPage = await context.newPage();
  await adminPage.setViewportSize(VIEWPORT);

  const adminUrl = `${BASE}${ADMIN_PATH.startsWith('/') ? ADMIN_PATH : `/${ADMIN_PATH}`}`;
  const res = await adminPage.goto(adminUrl, { waitUntil: 'networkidle', timeout: 120000 });
  if (!res || res.status() !== 200) {
    skipped.push(`All admin screenshots — ${adminUrl} returned HTTP ${res?.status() ?? 'error'}`);
    await adminPage.close();
    return;
  }

  await wait(SHOT_DELAY_MS);
  await shot(adminPage, 'admin-login-empty.png', 'Admin login before password');

  await adminPage.locator('#passwordInput').fill(ADMIN_PASSWORD);
  await shot(adminPage, 'admin-login.png', 'Admin login with password filled');

  const loginBtn = adminPage.locator('#loginView button[onclick="doLogin()"]');
  if (await loginBtn.count()) {
    await loginBtn.click();
    await adminPage.locator('#appView').waitFor({ state: 'visible', timeout: 15000 });
  } else {
    await adminPage.locator('#appView').waitFor({ state: 'visible', timeout: 5000 });
  }
  await wait(SHOT_DELAY_MS);

  const adminTabs = [
    { tab: 'dashboard', file: 'admin-dashboard.png', note: 'Admin dashboard tab' },
    { tab: 'users', file: 'admin-users.png', note: 'Admin users tab' },
    { tab: 'announcements', file: 'admin-announcements-list.png', note: 'Admin announcements list' },
    { tab: 'rules', file: 'admin-rules.png', note: 'Admin extract rules tab' },
    { tab: 'ratelimit', file: 'admin-request-monitor.png', note: 'Admin request monitor tab' },
    { tab: 'domains', file: 'admin-domains.png', note: 'Admin mail domains tab' },
    { tab: 'settings', file: 'admin-settings.png', note: 'Admin system settings tab' },
    { tab: 'audit', file: 'admin-audit.png', note: 'Admin audit log tab' },
  ];

  for (const { tab, file, note } of adminTabs) {
    await adminSwitchTab(adminPage, tab);
    await shot(adminPage, file, note);
  }

  await adminSwitchTab(adminPage, 'announcements');
  await adminPage.locator('button:has-text("新增公告")').click();
  await adminPage.locator('#announcementModal').waitFor({ state: 'visible', timeout: 10000 });
  await adminPage.locator('#announcementTitle').fill('文档截图示例公告');
  await adminPage.locator('#announcementContent').fill('用于文档截图的示例公告内容。');
  await shot(adminPage, 'admin-announcement-create.png', 'Admin create announcement modal');
  await adminPage.locator('#announcementModal button:has-text("取消")').click();

  await adminPage.close();
}

async function main() {
  await clearScreenshots();

  const launchOpts = { headless: process.env.HEADLESS !== 'false' };
  if (BROWSER_EXE) launchOpts.executablePath = BROWSER_EXE;
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ viewport: VIEWPORT });

  const state = { apiToken: null, otpMailboxEmail: null };

  const steps = [
    ['public-pages', async () => capturePublicPages(context)],
    ['login', async () => {
      const page = await context.newPage();
      await page.setViewportSize(VIEWPORT);
      await login(page);
      state.page = page;
    }],
    ['dashboard', async () => captureDashboardUsage(state.page)],
    ['api-keys', async () => captureApiKeys(state.page, state)],
    ['inbox-new-mailbox', async () => captureInboxNewMailbox(state.page, state)],
    ['inbox-with-otp', async () => captureInboxWithOtp(state.page, state)],
    ['inbox-history', async () => captureInboxHistory(state.page)],
    ['outbox', async () => captureOutbox(state.page)],
    ['extract-rules', async () => captureExtractRules(state.page)],
    ['api-debug', async () => captureApiDebug(state.page)],
    ['docs', async () => captureDocs(context)],
    ['admin', async () => captureAdmin(context)],
  ];

  const onlySteps = process.env.ONLY_STEPS?.split(',').map((s) => s.trim()).filter(Boolean);

  try {
    for (const [name, fn] of steps) {
      if (onlySteps?.length && !onlySteps.includes(name)) continue;
      try {
        await fn();
      } catch (err) {
        console.error(`Step "${name}" failed:`, err.message);
      }
    }
  } finally {
    if (state.page) await state.page.close();
    await browser.close();
  }

  console.log('\n=== Summary ===');
  for (const r of results) console.log(`  ${r.name}: ${r.note}`);
  if (skipped.length) {
    console.log('\nSkipped:');
    for (const s of skipped) console.log(`  ${s}`);
  }
  console.log(`\nTotal: ${results.length} screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
