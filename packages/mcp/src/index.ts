import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getConfig() {
  const baseUrl = requireEnv('ZMAILR_BASE_URL').replace(/\/$/, '');
  const token = requireEnv('ZMAILR_TOKEN');
  return { baseUrl, token };
}

async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown; searchParams?: Record<string, string> } = {}
): Promise<{ status: number; body: unknown; text: string }> {
  const { baseUrl, token } = getConfig();
  const url = new URL(path, baseUrl);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }
  return { status: res.status, body, text };
}

function toolText(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const server = new Server(
  { name: 'zmailr', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'lease_mailbox',
      description: 'Create a new random 24h temporary mailbox (POST /api/lease). Requires lease scope.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'wait_for_mail',
      description:
        'Long-poll for incoming mail on a mailbox (GET /api/mail). Returns extracted OTP when require_code is true.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Mailbox email or local-part' },
          timeout: { type: 'number', description: 'Seconds to wait (1-55, default 60)' },
          since: { type: 'number', description: 'Unix timestamp; only newer emails' },
          require_code: { type: 'boolean', description: 'Require extracted code (default true)' },
        },
        required: ['to'],
      },
    },
    {
      name: 'get_latest_code',
      description: 'Instant lookup of latest OTP on a mailbox (GET /api/mailboxes/:address/latest-code).',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Mailbox local-part (e.g. abc123)' },
        },
        required: ['address'],
      },
    },
    {
      name: 'send_email',
      description: 'Send outbound email via Brevo (POST /api/send). Requires send scope.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          text: { type: 'string' },
          html: { type: 'string' },
          from: { type: 'string', description: 'Optional leased mailbox as sender' },
        },
        required: ['to', 'subject'],
      },
    },
    {
      name: 'get_quota',
      description: 'Daily send quota and usage (GET /api/user/quota).',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (request.params.name) {
      case 'lease_mailbox': {
        const res = await apiRequest('/api/lease', { method: 'POST' });
        if (res.status >= 400) return toolError(`lease_mailbox failed (${res.status}): ${res.text}`);
        return toolText(res.body);
      }

      case 'wait_for_mail': {
        const to = String(args.to ?? '');
        if (!to) return toolError('wait_for_mail requires "to"');
        const params: Record<string, string> = { to };
        if (args.timeout != null) params.timeout = String(args.timeout);
        if (args.since != null) params.since = String(args.since);
        if (args.require_code != null) params.require_code = String(args.require_code);
        const res = await apiRequest('/api/mail', { searchParams: params });
        if (res.status >= 400) return toolError(`wait_for_mail failed (${res.status}): ${res.text}`);
        return toolText(res.body);
      }

      case 'get_latest_code': {
        const address = String(args.address ?? '');
        if (!address) return toolError('get_latest_code requires "address"');
        const res = await apiRequest(`/api/mailboxes/${encodeURIComponent(address)}/latest-code`);
        if (res.status >= 400) return toolError(`get_latest_code failed (${res.status}): ${res.text}`);
        return toolText(res.body);
      }

      case 'send_email': {
        const to = String(args.to ?? '');
        const subject = String(args.subject ?? '');
        if (!to || !subject) return toolError('send_email requires "to" and "subject"');
        const body: Record<string, string> = { to, subject };
        if (args.text != null) body.text = String(args.text);
        if (args.html != null) body.html = String(args.html);
        if (args.from != null) body.from = String(args.from);
        if (!body.text && !body.html) return toolError('send_email requires "text" or "html"');
        const res = await apiRequest('/api/send', { method: 'POST', body });
        if (res.status >= 400) return toolError(`send_email failed (${res.status}): ${res.text}`);
        return toolText(res.body);
      }

      case 'get_quota': {
        const res = await apiRequest('/api/user/quota');
        if (res.status >= 400) return toolError(`get_quota failed (${res.status}): ${res.text}`);
        return toolText(res.body);
      }

      default:
        return toolError(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
});

async function main() {
  getConfig();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('zmailr-mcp failed:', error);
  process.exit(1);
});
