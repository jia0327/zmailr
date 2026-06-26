export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = requireEnv('ZMAILR_BASE_URL', env).replace(/\/$/, '');
  const token = requireEnv('ZMAILR_TOKEN', env);
  return { baseUrl, token };
}

export type ApiConfig = ReturnType<typeof getConfig>;
export type FetchFn = typeof fetch;

export async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown; searchParams?: Record<string, string> } = {},
  config: ApiConfig = getConfig(),
  fetchFn: FetchFn = fetch
): Promise<{ status: number; body: unknown; text: string }> {
  const url = new URL(path, config.baseUrl);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetchFn(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
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

export function toolText(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  };
}

export function toolError(message: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return { content: [{ type: 'text', text: message }], isError: true };
}

export const TOOL_DEFINITIONS = [
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
        address: { type: 'string', description: 'Mailbox local-part or full email' },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_latest_link',
    description: 'Instant lookup of latest verification link on a mailbox (GET /api/mailboxes/:address/latest-link).',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Mailbox local-part or full email' },
      },
      required: ['address'],
    },
  },
  {
    name: 'list_mailboxes',
    description: 'List mailboxes owned by the authenticated user (GET /api/mailboxes). Requires mail scope.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (1-100, default 50)' },
      },
    },
  },
  {
    name: 'list_emails',
    description: 'List emails in a mailbox (GET /api/mailboxes/:address/emails). Requires mail scope.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Mailbox local-part or full email' },
      },
      required: ['address'],
    },
  },
  {
    name: 'delete_mailbox',
    description: 'Delete a mailbox and all its emails (DELETE /api/mailboxes/:address). Requires mail scope.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Mailbox local-part or full email' },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_email',
    description: 'Get a single email by ID (GET /api/emails/:id). Requires mail scope.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Email ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_email',
    description: 'Delete a single email by ID (DELETE /api/emails/:id). Requires mail scope.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Email ID' },
      },
      required: ['id'],
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
] as const;

export const TOOL_NAMES = TOOL_DEFINITIONS.map((tool) => tool.name);

export type ToolDeps = {
  config?: ApiConfig;
  fetchFn?: FetchFn;
};

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  deps: ToolDeps = {}
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }> {
  const config = deps.config ?? getConfig();
  const fetchFn = deps.fetchFn ?? fetch;

  const request = (path: string, options: Parameters<typeof apiRequest>[1] = {}) =>
    apiRequest(path, options, config, fetchFn);

  switch (name) {
    case 'lease_mailbox': {
      const res = await request('/api/lease', { method: 'POST' });
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
      const res = await request('/api/mail', { searchParams: params });
      if (res.status >= 400) return toolError(`wait_for_mail failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'get_latest_code': {
      const address = String(args.address ?? '');
      if (!address) return toolError('get_latest_code requires "address"');
      const res = await request(`/api/mailboxes/${encodeURIComponent(address)}/latest-code`);
      if (res.status >= 400) return toolError(`get_latest_code failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'get_latest_link': {
      const address = String(args.address ?? '');
      if (!address) return toolError('get_latest_link requires "address"');
      const res = await request(`/api/mailboxes/${encodeURIComponent(address)}/latest-link`);
      if (res.status >= 400) return toolError(`get_latest_link failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'list_mailboxes': {
      const params: Record<string, string> = {};
      if (args.limit != null) params.limit = String(args.limit);
      const res = await request('/api/mailboxes', { searchParams: params });
      if (res.status >= 400) return toolError(`list_mailboxes failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'list_emails': {
      const address = String(args.address ?? '');
      if (!address) return toolError('list_emails requires "address"');
      const res = await request(`/api/mailboxes/${encodeURIComponent(address)}/emails`);
      if (res.status >= 400) return toolError(`list_emails failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'delete_mailbox': {
      const address = String(args.address ?? '');
      if (!address) return toolError('delete_mailbox requires "address"');
      const res = await request(`/api/mailboxes/${encodeURIComponent(address)}`, { method: 'DELETE' });
      if (res.status >= 400) return toolError(`delete_mailbox failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'get_email': {
      const id = String(args.id ?? '');
      if (!id) return toolError('get_email requires "id"');
      const res = await request(`/api/emails/${encodeURIComponent(id)}`);
      if (res.status >= 400) return toolError(`get_email failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'delete_email': {
      const id = String(args.id ?? '');
      if (!id) return toolError('delete_email requires "id"');
      const res = await request(`/api/emails/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status >= 400) return toolError(`delete_email failed (${res.status}): ${res.text}`);
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
      const res = await request('/api/send', { method: 'POST', body });
      if (res.status >= 400) return toolError(`send_email failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    case 'get_quota': {
      const res = await request('/api/user/quota');
      if (res.status >= 400) return toolError(`get_quota failed (${res.status}): ${res.text}`);
      return toolText(res.body);
    }

    default:
      return toolError(`Unknown tool: ${name}`);
  }
}
