export type HttpMethod = 'GET' | 'POST' | 'DELETE';

export type ApiScope = 'lease' | 'mail' | 'send' | 'none';

export type FieldKind = 'path' | 'query' | 'body';

export interface EndpointField {
  name: string;
  kind: FieldKind;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}

export interface ApiEndpointDef {
  id: string;
  method: HttpMethod;
  pathTemplate: string;
  categoryKey: string;
  scope: ApiScope;
  requiresAuth: boolean;
  responseType: 'json' | 'text';
  fields: EndpointField[];
}

export const API_DEBUG_ENDPOINTS: ApiEndpointDef[] = [
  {
    id: 'lease',
    method: 'POST',
    pathTemplate: '/api/lease',
    categoryKey: 'apiDebug.categories.lease',
    scope: 'lease',
    requiresAuth: true,
    responseType: 'json',
    fields: [],
  },
  {
    id: 'mailboxes-list',
    method: 'GET',
    pathTemplate: '/api/mailboxes',
    categoryKey: 'apiDebug.categories.mailbox',
    scope: 'mail',
    requiresAuth: true,
    responseType: 'json',
    fields: [
      { name: 'limit', kind: 'query', type: 'number', defaultValue: '50', placeholder: '50' },
    ],
  },
  {
    id: 'mailboxes-delete',
    method: 'DELETE',
    pathTemplate: '/api/mailboxes/:address',
    categoryKey: 'apiDebug.categories.mailbox',
    scope: 'mail',
    requiresAuth: true,
    responseType: 'json',
    fields: [
      { name: 'address', kind: 'path', type: 'string', required: true, placeholder: 'abc123' },
    ],
  },
  {
    id: 'mailboxes-latest-code',
    method: 'GET',
    pathTemplate: '/api/mailboxes/:address/latest-code',
    categoryKey: 'apiDebug.categories.mailbox',
    scope: 'mail',
    requiresAuth: true,
    responseType: 'json',
    fields: [
      { name: 'address', kind: 'path', type: 'string', required: true, placeholder: 'abc123' },
    ],
  },
  {
    id: 'mailboxes-latest-link',
    method: 'GET',
    pathTemplate: '/api/mailboxes/:address/latest-link',
    categoryKey: 'apiDebug.categories.mailbox',
    scope: 'mail',
    requiresAuth: true,
    responseType: 'json',
    fields: [
      { name: 'address', kind: 'path', type: 'string', required: true, placeholder: 'abc123' },
    ],
  },
  {
    id: 'mail-poll',
    method: 'GET',
    pathTemplate: '/api/mail',
    categoryKey: 'apiDebug.categories.receive',
    scope: 'mail',
    requiresAuth: true,
    responseType: 'json',
    fields: [
      { name: 'to', kind: 'query', type: 'string', required: true, defaultValue: 'abc123@example.com', placeholder: 'abc123@example.com' },
      { name: 'timeout', kind: 'query', type: 'number', defaultValue: '60', placeholder: '60' },
      { name: 'since', kind: 'query', type: 'number', placeholder: '1719350000' },
      {
        name: 'require_code',
        kind: 'query',
        type: 'boolean',
        defaultValue: 'true',
      },
    ],
  },
  {
    id: 'send',
    method: 'POST',
    pathTemplate: '/api/send',
    categoryKey: 'apiDebug.categories.send',
    scope: 'send',
    requiresAuth: true,
    responseType: 'json',
    fields: [
      { name: 'to', kind: 'body', type: 'string', required: true, defaultValue: 'user@qq.com', placeholder: 'user@example.com' },
      { name: 'subject', kind: 'body', type: 'string', required: true, defaultValue: 'Hello', placeholder: 'Hello' },
      { name: 'text', kind: 'body', type: 'string', required: true, defaultValue: 'Plain text body', placeholder: 'Plain text body' },
      { name: 'from', kind: 'body', type: 'string', defaultValue: 'abc123@example.com', placeholder: 'abc123@example.com' },
    ],
  },
  {
    id: 'emails-get',
    method: 'GET',
    pathTemplate: '/api/emails/:id',
    categoryKey: 'apiDebug.categories.email',
    scope: 'mail',
    requiresAuth: true,
    responseType: 'json',
    fields: [{ name: 'id', kind: 'path', type: 'string', required: true, placeholder: 'email-id' }],
  },
  {
    id: 'emails-raw',
    method: 'GET',
    pathTemplate: '/api/emails/:id/raw',
    categoryKey: 'apiDebug.categories.email',
    scope: 'mail',
    requiresAuth: true,
    responseType: 'text',
    fields: [{ name: 'id', kind: 'path', type: 'string', required: true, placeholder: 'email-id' }],
  },
];

export const API_DEBUG_CATEGORIES = [
  'apiDebug.categories.lease',
  'apiDebug.categories.mailbox',
  'apiDebug.categories.receive',
  'apiDebug.categories.send',
  'apiDebug.categories.email',
] as const;

export function getEndpointById(id: string): ApiEndpointDef | undefined {
  return API_DEBUG_ENDPOINTS.find((e) => e.id === id);
}

export function buildUrl(
  baseUrl: string,
  endpoint: ApiEndpointDef,
  values: Record<string, string>
): string {
  let path = endpoint.pathTemplate;
  for (const field of endpoint.fields.filter((f) => f.kind === 'path')) {
    const val = values[field.name] ?? '';
    path = path.replace(`:${field.name}`, encodeURIComponent(val));
  }

  const url = new URL(path, baseUrl);
  for (const field of endpoint.fields.filter((f) => f.kind === 'query')) {
    const val = values[field.name];
    if (val === '' || val == null) continue;
    if (field.type === 'boolean') {
      url.searchParams.set(field.name, val === 'true' ? 'true' : 'false');
    } else {
      url.searchParams.set(field.name, val);
    }
  }
  return url.toString();
}

export function buildBody(
  endpoint: ApiEndpointDef,
  values: Record<string, string>
): string | undefined {
  const bodyFields = endpoint.fields.filter((f) => f.kind === 'body');
  if (bodyFields.length === 0) return undefined;

  const body: Record<string, unknown> = {};
  for (const field of bodyFields) {
    const val = values[field.name];
    if (val === '' || val == null) continue;
    body[field.name] = val;
  }
  return JSON.stringify(body);
}

export function defaultFieldValues(endpoint: ApiEndpointDef): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of endpoint.fields) {
    values[field.name] = field.defaultValue ?? '';
  }
  return values;
}
