/**
 * Verify public doc / app URLs return HTTP 2xx (or 3xx to login for protected routes).
 * Usage: node scripts/verify-doc-links.mjs [baseUrl]
 */
const BASE = (process.argv[2] || process.env.ZMAILR_BASE_URL || 'https://zmailr.onlydev.ccwu.cc').replace(
  /\/$/,
  ''
);

const checks = [
  { path: '/', name: 'landing' },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/forgot-password', name: 'forgot-password' },
  { path: '/docs/', name: 'docs home' },
  { path: '/docs/overview', name: 'docs overview' },
  { path: '/docs/quickstart-5min', name: 'docs quickstart' },
  { path: '/docs/mcp', name: 'docs mcp' },
  { path: '/docs/api-overview', name: 'docs api-overview' },
  { path: '/docs/api', name: 'docs api reference' },
  { path: '/openapi.json', name: 'openapi.json' },
  { path: '/api-docs', name: 'interactive api-docs' },
  { path: '/api-docs?embed=1', name: 'api-docs embed' },
  { path: '/api/health', name: 'health' },
  { path: '/api/public/status', name: 'public status' },
];

async function checkOne({ path, name }) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const finalUrl = res.url;
    const ok = res.status >= 200 && res.status < 400;
    let bodyHint = '';
    if (path.startsWith('/api-docs')) {
      const text = await res.text();
      bodyHint = text.includes('apiDocs') || text.includes('API') ? ' (api docs content)' : ' (missing api docs UI)';
      if (!text.includes('GET /api/') && !text.includes('apiDocs')) {
        return { name, path, status: res.status, ok: false, finalUrl, bodyHint };
      }
    }
    return { name, path, status: res.status, ok, finalUrl, bodyHint };
  } catch (err) {
    return { name, path, status: 0, ok: false, error: err.message };
  }
}

const results = await Promise.all(checks.map(checkOne));
const failed = results.filter((r) => !r.ok);

for (const r of results) {
  const mark = r.ok ? '✓' : '✗';
  const extra = r.finalUrl && r.finalUrl !== `${BASE}${r.path}` ? ` → ${r.finalUrl}` : '';
  const hint = r.bodyHint || (r.error ? ` (${r.error})` : '');
  console.log(`${mark} ${r.status} ${r.name} ${r.path}${extra}${hint}`);
}

if (failed.length) {
  console.error(`\n${failed.length} link(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} links OK on ${BASE}`);
