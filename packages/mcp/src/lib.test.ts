import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  apiRequest,
  getConfig,
  handleToolCall,
  requireEnv,
  TOOL_DEFINITIONS,
  TOOL_NAMES,
} from './lib.js';

const TEST_CONFIG = {
  baseUrl: 'https://zmailr.example.com',
  token: 'test-token',
};

function mockFetch(response: { status: number; body: unknown }) {
  const text = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
  return mock.fn(async () =>
    Response.json(response.body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    })
  ) as unknown as typeof fetch;
}

describe('requireEnv', () => {
  it('returns trimmed value when set', () => {
    assert.equal(requireEnv('ZMAILR_TOKEN', { ZMAILR_TOKEN: '  abc  ' }), 'abc');
  });

  it('throws when missing or blank', () => {
    assert.throws(() => requireEnv('ZMAILR_TOKEN', {}), /Missing required environment variable: ZMAILR_TOKEN/);
    assert.throws(() => requireEnv('ZMAILR_TOKEN', { ZMAILR_TOKEN: '   ' }), /Missing required environment variable/);
  });
});

describe('getConfig', () => {
  it('strips trailing slash from base URL', () => {
    const config = getConfig({
      ZMAILR_BASE_URL: 'https://zmailr.example.com/',
      ZMAILR_TOKEN: 'token',
    });
    assert.equal(config.baseUrl, 'https://zmailr.example.com');
    assert.equal(config.token, 'token');
  });
});

describe('tool registration', () => {
  it('registers all expected tools', () => {
    assert.equal(TOOL_DEFINITIONS.length, 11);
    assert.deepEqual(TOOL_NAMES, [
      'lease_mailbox',
      'wait_for_mail',
      'get_latest_code',
      'get_latest_link',
      'list_mailboxes',
      'list_emails',
      'delete_mailbox',
      'get_email',
      'delete_email',
      'send_email',
      'get_quota',
    ]);
  });

  it('each tool has name, description, and inputSchema', () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(tool.name);
      assert.ok(tool.description);
      assert.equal(tool.inputSchema.type, 'object');
    }
  });
});

describe('apiRequest', () => {
  it('sends Bearer auth and parses JSON', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetchFn = mock.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return Response.json({ success: true }, { status: 200 });
    }) as unknown as typeof fetch;

    const res = await apiRequest('/api/user/quota', {}, TEST_CONFIG, fetchFn);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(capturedUrl, 'https://zmailr.example.com/api/user/quota');
    assert.equal((capturedInit?.headers as Record<string, string>).Authorization, 'Bearer test-token');
  });
});

describe('handleToolCall', () => {
  it('returns error for unknown tool', async () => {
    const result = await handleToolCall('missing_tool', {}, { config: TEST_CONFIG, fetchFn: mockFetch({ status: 200, body: {} }) });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Unknown tool/);
  });

  it('validates required arguments', async () => {
    const fetchFn = mockFetch({ status: 200, body: {} });
    const result = await handleToolCall('list_emails', {}, { config: TEST_CONFIG, fetchFn });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /requires "address"/);
  });

  it('calls list_mailboxes with limit query param', async () => {
    let capturedUrl = '';
    const fetchFn = mock.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return Response.json({ success: true, mailboxes: [] }, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await handleToolCall('list_mailboxes', { limit: 10 }, { config: TEST_CONFIG, fetchFn });
    assert.equal(result.isError, undefined);
    assert.match(capturedUrl, /\/api\/mailboxes\?limit=10$/);
  });

  it('calls get_latest_link for mailbox address', async () => {
    let capturedUrl = '';
    const fetchFn = mock.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return Response.json({ success: true, link: 'https://verify.example/abc' }, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await handleToolCall('get_latest_link', { address: 'abc123' }, { config: TEST_CONFIG, fetchFn });
    assert.equal(result.isError, undefined);
    assert.match(capturedUrl, /\/api\/mailboxes\/abc123\/latest-link$/);
    assert.match(result.content[0].text, /verify.example/);
  });

  it('surfaces API errors', async () => {
    const fetchFn = mockFetch({ status: 404, body: { error: 'not found' } });
    const result = await handleToolCall('delete_email', { id: 'email-1' }, { config: TEST_CONFIG, fetchFn });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /delete_email failed \(404\)/);
  });

  it('returns JSON text for successful lease_mailbox', async () => {
    const fetchFn = mockFetch({ status: 200, body: { success: true, address: 'abc123@example.com' } });
    const result = await handleToolCall('lease_mailbox', {}, { config: TEST_CONFIG, fetchFn });
    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /abc123@example.com/);
  });
});
