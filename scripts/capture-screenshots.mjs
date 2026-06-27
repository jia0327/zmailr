/**
 * Capture documentation screenshots from live zMailR demo.
 * Usage: node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.SCREENSHOT_DIR
  ? path.resolve(process.env.SCREENSHOT_DIR)
  : path.resolve(__dirname, '../docs/screenshots');
const BASE = process.env.ZMAILR_BASE_URL || 'https://zmailr.onlydev.ccwu.cc';
const ADMIN_PATH = process.env.ADMIN_PATH || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const VIEWPORT = { width: 1280, height: 900 };
const OTP_CODE = '847291';
const BROWSER_EXE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || null;

const results = [];
const skipped = [];

function log(name, note) {
  results.push({ name, note });
  console.log(`✓ ${name}: ${note}`);
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(t);
  }, theme);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="username"]').fill('guest');
  await page.locator('input[autocomplete="current-password"]').fill('guest');
  await page.screenshot({ path: path.join(OUT_DIR, 'login.png'), fullPage: false });
  log('login.png', 'Login page with guest credentials filled in');

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard/**', { timeout: 30000 });
  await wait(800);
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
  await page.goto(`${BASE}/dashboard/inbox`, { waitUntil: 'networkidle' });
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

async function captureDashboard(page) {
  await page.goto(`${BASE}/dashboard/usage`, { waitUntil: 'networkidle' });
  await setTheme(page, 'dark');
  await wait(800);
  await page.screenshot({ path: path.join(OUT_DIR, 'dashboard.png'), fullPage: true });
  log('dashboard.png', 'Usage stats and token status on /dashboard/usage');
}

async function ensureApiToken(page, state) {
  if (state.apiToken) return state.apiToken;

  state.apiToken = await readStoredApiToken(page);
  if (state.apiToken) return state.apiToken;

  state.apiToken = await page.evaluate(() => {
    const codes = [...document.querySelectorAll('code.font-mono')];
    for (const el of codes) {
      const text = el.textContent?.trim();
      if (text?.startsWith('zm_') && text.length > 12) return text;
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

async function captureApiKeys(page, state) {
  await page.goto(`${BASE}/dashboard/api-keys`, { waitUntil: 'networkidle' });
  await page
    .locator('h2')
    .filter({ hasText: /API Token|API 密钥/i })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });
  await wait(800);

  const recreateBtn = page.getByRole('button', { name: /删除并重新创建以复制|Recreate to copy/i });
  const createHeaderBtn = page.getByRole('button', { name: /创建 Token|Create Token/i });

  if (await recreateBtn.count()) {
    page.once('dialog', (d) => d.accept());
    await recreateBtn.first().click();
    await page
      .locator('code.font-mono')
      .filter({ hasText: /^zm_/ })
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
      .filter({ hasText: /^zm_/ })
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
  } else {
    await ensureApiToken(page, state);
  }

  await ensureApiToken(page, state);
  await page.screenshot({ path: path.join(OUT_DIR, 'api-keys-create.png'), fullPage: true });
  log('api-keys-create.png', 'API token creation / regenerate view');
}

async function captureInboxNewMailbox(page, state) {
  await createMailbox(page);
  state.otpMailboxEmail = await getActiveMailboxEmail(page);
  await page.screenshot({ path: path.join(OUT_DIR, 'inbox-new-mailbox.png'), fullPage: true });
  log('inbox-new-mailbox.png', 'New mailbox created, empty inbox, page 1 mailbox history');
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

  const mailSection = page
    .locator('.border.rounded-md.overflow-hidden')
    .filter({ has: page.locator(`text=${OTP_CODE}`) });
  if (await mailSection.count()) {
    await mailSection.first().scrollIntoViewIfNeeded();
    await mailSection.first().screenshot({ path: path.join(OUT_DIR, 'inbox-with-otp.png') });
  } else {
    await page.locator(`text=${OTP_CODE}`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT_DIR, 'inbox-with-otp.png'), fullPage: false });
  }
  log('inbox-with-otp.png', `Inbox with OTP ${OTP_CODE} highlighted in amber box`);
}

async function captureInboxHistory(page) {
  // Create 3 more mailboxes to reach page 2 (page size = 3)
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
    await historySection.screenshot({ path: path.join(OUT_DIR, 'inbox.png') });
    log('inbox.png', 'Mailbox history pagination on page 2+ (distinct from OTP view)');
  } else {
    await historySection.screenshot({ path: path.join(OUT_DIR, 'inbox.png') });
    log('inbox.png', 'Mailbox history list (pagination not available, showing history section)');
  }
}

async function captureOutbox(page) {
  await page.goto(`${BASE}/dashboard/outbox`, { waitUntil: 'networkidle' });
  await setTheme(page, 'light');
  await wait(800);

  // Plain text tab
  await page.getByRole('button', { name: /纯文本|Plain/i }).first().click();
  await wait(400);
  await page.screenshot({ path: path.join(OUT_DIR, 'outbox-send.png'), fullPage: true });
  log('outbox-send.png', 'Full outbox page in light mode with plain text compose tab');

  // Rich text tab with demo content
  await page.locator('.flex.rounded-md.border.overflow-hidden.text-xs button').filter({ hasText: /富文本|Rich/i }).click();
  await wait(600);
  const subjectInput = page.locator('label').filter({ hasText: /主题|Subject/i }).locator('..').locator('input');
  await subjectInput.fill('富文本 E2E 截图');
  const editor = page.locator('.ql-editor');
  if (await editor.count()) {
    await editor.click();
    await editor.fill('这是富文本编辑器演示内容，用于文档截图。\n支持加粗、链接等格式。');
  }
  await wait(500);

  const composeCard = page.locator('.border.rounded-lg').filter({ has: page.getByText(/撰写|Compose|发送/i) }).first();
  const richArea = page.locator('form').filter({ has: page.locator('.ql-editor') });
  if (await richArea.count()) {
    await richArea.screenshot({ path: path.join(OUT_DIR, 'outbox-rich-text.png') });
  } else {
    await page.locator('.ql-container').screenshot({ path: path.join(OUT_DIR, 'outbox-rich-text.png') });
  }
  log('outbox-rich-text.png', 'Rich text tab and Quill editor with demo subject/body');

  // Sent list only
  const sentList = page.locator('.border.rounded-lg').filter({ has: page.getByText(/已发送|Sent/i) }).last();
  await sentList.scrollIntoViewIfNeeded();
  await wait(400);
  await sentList.screenshot({ path: path.join(OUT_DIR, 'outbox-sent.png') });
  log('outbox-sent.png', 'Sent emails list cropped, no compose overlap');

  // Sent detail modal
  const firstRow = sentList.locator('.cursor-pointer, .divide-y > div').first();
  if (await firstRow.count()) {
    await firstRow.click();
    await wait(800);
    const modal = page.locator('[role="dialog"], .fixed.inset-0').filter({ has: page.locator('text=/主题|Subject/i') }).first();
    if (await modal.count()) {
      await modal.screenshot({ path: path.join(OUT_DIR, 'outbox-sent-detail.png') });
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, 'outbox-sent-detail.png'), fullPage: false });
    }
    log('outbox-sent-detail.png', 'Sent email detail modal');
    await page.keyboard.press('Escape');
  } else {
    skipped.push('outbox-sent-detail.png — no sent emails to open');
  }
}

async function captureExtractRules(page) {
  await page.goto(`${BASE}/dashboard/extract-rules`, { waitUntil: 'networkidle' });
  await setTheme(page, 'dark');
  await page.locator('.max-w-4xl').waitFor({ state: 'visible', timeout: 30000 });
  await wait(800);
  const addBtn = page.getByRole('button', { name: /新增规则|Add Rule/i });
  await addBtn.waitFor({ state: 'visible', timeout: 30000 });
  await addBtn.click();
  await page.locator('#rule-domain').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#rule-domain').fill('example.com');
  await page.locator('#rule-regex').fill('(?:code|验证码)[：:\\s]*(\\d{4,8})');
  await page.screenshot({ path: path.join(OUT_DIR, 'extract-rules-custom.png'), fullPage: true });
  log('extract-rules-custom.png', 'Custom extract rule form open with sample values');
}

async function captureApiDebug(page) {
  await page.goto(`${BASE}/dashboard/api-debug`, { waitUntil: 'networkidle' });
  await wait(1000);
  await page.locator('#endpoint-select').selectOption('user-quota');
  await wait(400);
  await page.getByRole('button', { name: /发送请求/i }).click();
  await wait(2000);
  await page.screenshot({ path: path.join(OUT_DIR, 'api-debug-response.png'), fullPage: true });
  log('api-debug-response.png', 'GET /api/user/quota JSON response with rate limit headers');
}

async function captureDocs(page, context) {
  const docsPage = await context.newPage();
  await docsPage.setViewportSize(VIEWPORT);

  await docsPage.goto(`${BASE}/docs/`, { waitUntil: 'networkidle' });
  await wait(1000);
  await docsPage.screenshot({ path: path.join(OUT_DIR, 'docs-home.png'), fullPage: true });
  log('docs-home.png', 'VitePress docs home at /docs/');

  await docsPage.goto(`${BASE}/api-docs`, { waitUntil: 'networkidle' });
  await wait(1500);
  await docsPage.screenshot({ path: path.join(OUT_DIR, 'api-interactive.png'), fullPage: true });
  log('api-interactive.png', 'Interactive API docs at /api-docs');

  await docsPage.goto(`${BASE}/docs/testing.html`, { waitUntil: 'networkidle' });
  await wait(1500);
  await docsPage.screenshot({ path: path.join(OUT_DIR, 'docs-testing.png'), fullPage: true });
  log('docs-testing.png', 'Full testing report page');

  await docsPage.close();
}

async function adminSwitchTab(page, tabName) {
  await page.locator(`.tab[data-tab="${tabName}"]`).click();
  await page.locator(`#panel-${tabName}.active`).waitFor({ state: 'visible', timeout: 15000 });
  await wait(800);
}

async function captureAdmin(context) {
  if (!ADMIN_PATH || !ADMIN_PASSWORD) {
    skipped.push('All admin screenshots — set ADMIN_PATH and ADMIN_PASSWORD env vars');
    return;
  }

  const adminPage = await context.newPage();
  await adminPage.setViewportSize(VIEWPORT);

  const adminUrl = `${BASE}${ADMIN_PATH.startsWith('/') ? ADMIN_PATH : `/${ADMIN_PATH}`}`;
  const res = await adminPage.goto(adminUrl, { waitUntil: 'domcontentloaded' });
  if (!res || res.status() !== 200) {
    skipped.push(`All admin screenshots — ${adminUrl} returned HTTP ${res?.status() ?? 'error'}`);
    await adminPage.close();
    return;
  }

  await adminPage.locator('#passwordInput').fill(ADMIN_PASSWORD);
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-login.png'), fullPage: true });
  log('admin-login.png', 'Admin login page with password filled');

  await adminPage.locator('button:has-text("登录")').click();
  await adminPage.locator('#appView').waitFor({ state: 'visible', timeout: 15000 });
  await wait(1200);

  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-dashboard.png'), fullPage: true });
  log('admin-dashboard.png', 'Dashboard tab with health + stats');

  await adminSwitchTab(adminPage, 'announcements');
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-announcements-list.png'), fullPage: true });
  log('admin-announcements-list.png', 'Announcements list tab');

  await adminPage.locator('button:has-text("新增公告")').click();
  await adminPage.locator('#announcementModal').waitFor({ state: 'visible', timeout: 10000 });
  await adminPage.locator('#announcementTitle').fill('文档截图示例公告');
  await adminPage.locator('#announcementContent').fill('用于文档截图的示例公告内容。');
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-announcement-create.png'), fullPage: true });
  log('admin-announcement-create.png', 'Create announcement modal');
  await adminPage.locator('#announcementModal button:has-text("取消")').click();
  await wait(400);

  await adminSwitchTab(adminPage, 'users');
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-users.png'), fullPage: true });
  log('admin-users.png', 'Users tab');

  await adminSwitchTab(adminPage, 'rules');
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-rules.png'), fullPage: true });
  log('admin-rules.png', 'Extract rules tab');

  await adminSwitchTab(adminPage, 'ratelimit');
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-request-monitor.png'), fullPage: true });
  log('admin-request-monitor.png', 'Rate limit / request monitor tab');

  await adminSwitchTab(adminPage, 'settings');
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-settings.png'), fullPage: true });
  log('admin-settings.png', 'System settings tab');

  await adminSwitchTab(adminPage, 'audit');
  await adminPage.screenshot({ path: path.join(OUT_DIR, 'admin-audit.png'), fullPage: true });
  log('admin-audit.png', 'Audit log tab');

  await adminPage.close();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const launchOpts = { headless: process.env.HEADLESS !== 'false' };
  if (BROWSER_EXE) launchOpts.executablePath = BROWSER_EXE;
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const state = { apiToken: null, otpMailboxEmail: null };

  const steps = [
    ['login + dashboard', async () => { await login(page); await captureDashboard(page); }],
    ['api-keys', async () => captureApiKeys(page, state)],
    ['inbox-new-mailbox', async () => captureInboxNewMailbox(page, state)],
    ['inbox-with-otp', async () => captureInboxWithOtp(page, state)],
    ['inbox-history', async () => captureInboxHistory(page)],
    ['outbox', async () => captureOutbox(page)],
    ['extract-rules', async () => captureExtractRules(page)],
    ['api-debug', async () => captureApiDebug(page)],
    ['docs', async () => captureDocs(page, context)],
    ['admin', async () => captureAdmin(context)],
  ];

  try {
    for (const [name, fn] of steps) {
      try {
        await fn();
      } catch (err) {
        console.error(`Step "${name}" failed:`, err.message);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n=== Summary ===');
  for (const r of results) console.log(`  ${r.name}: ${r.note}`);
  if (skipped.length) {
    console.log('\nSkipped:');
    for (const s of skipped) console.log(`  ${s}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
