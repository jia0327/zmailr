import {
  deleteSuccessLine,
  emailDetailLine,
  emailsListLine,
  latestCodeLine,
  latestLinkLine,
  leaseResponseLine,
  mailboxesListLine,
  quotaResponseLine,
  quickstartResponseLine,
  rawEmailHint,
  sendResponseLine,
} from './apiDocExamples';

export type ShowcaseMethod = 'GET' | 'POST' | 'DELETE' | 'MCP';

export interface ApiShowcaseItem {
  method: ShowcaseMethod;
  path: string;
  status: string;
  body: string;
}

export interface ApiShowcaseGroup {
  categoryKey: string;
  items: ApiShowcaseItem[];
}

/** Bearer API groups for landing page showcase (aligned with OpenAPI / api-docs). */
export const LANDING_REST_API_GROUPS: ApiShowcaseGroup[] = [
  {
    categoryKey: 'apiDebug.categories.account',
    items: [
      {
        method: 'GET',
        path: '/api/user/quota',
        status: '200',
        body: quotaResponseLine,
      },
    ],
  },
  {
    categoryKey: 'apiDebug.categories.lease',
    items: [
      {
        method: 'POST',
        path: '/api/lease',
        status: '201',
        body: leaseResponseLine,
      },
    ],
  },
  {
    categoryKey: 'apiDebug.categories.mailbox',
    items: [
      {
        method: 'GET',
        path: '/api/mailboxes',
        status: '200',
        body: mailboxesListLine,
      },
      {
        method: 'DELETE',
        path: '/api/mailboxes/:address',
        status: '200',
        body: deleteSuccessLine,
      },
    ],
  },
  {
    categoryKey: 'apiDebug.categories.receive',
    items: [
      {
        method: 'GET',
        path: '/api/mail?timeout=60',
        status: '200',
        body: quickstartResponseLine,
      },
      {
        method: 'GET',
        path: '/api/mailboxes/:address/latest-code',
        status: '200',
        body: latestCodeLine,
      },
      {
        method: 'GET',
        path: '/api/mailboxes/:address/latest-link',
        status: '200',
        body: latestLinkLine,
      },
      {
        method: 'GET',
        path: '/api/mailboxes/:address/emails',
        status: '200',
        body: emailsListLine,
      },
      {
        method: 'GET',
        path: '/api/emails/:id',
        status: '200',
        body: emailDetailLine,
      },
      {
        method: 'GET',
        path: '/api/emails/:id/raw',
        status: '200',
        body: rawEmailHint,
      },
      {
        method: 'DELETE',
        path: '/api/emails/:id',
        status: '200',
        body: deleteSuccessLine,
      },
    ],
  },
  {
    categoryKey: 'apiDebug.categories.send',
    items: [
      {
        method: 'POST',
        path: '/api/send',
        status: '200',
        body: sendResponseLine,
      },
    ],
  },
];

/** MCP tools mapped to the same REST surface (@zmailr/mcp). */
export const LANDING_MCP_GROUPS: ApiShowcaseGroup[] = [
  {
    categoryKey: 'landing.showcaseMcpTools',
    items: [
      { method: 'MCP', path: 'get_quota', status: 'ok', body: quotaResponseLine },
      { method: 'MCP', path: 'lease_mailbox', status: 'ok', body: leaseResponseLine },
      { method: 'MCP', path: 'wait_for_mail', status: 'ok', body: quickstartResponseLine },
      { method: 'MCP', path: 'get_latest_code', status: 'ok', body: latestCodeLine },
      { method: 'MCP', path: 'get_latest_link', status: 'ok', body: latestLinkLine },
      { method: 'MCP', path: 'list_mailboxes', status: 'ok', body: mailboxesListLine },
      { method: 'MCP', path: 'list_emails', status: 'ok', body: emailsListLine },
      { method: 'MCP', path: 'get_email', status: 'ok', body: emailDetailLine },
      { method: 'MCP', path: 'delete_email', status: 'ok', body: deleteSuccessLine },
      { method: 'MCP', path: 'delete_mailbox', status: 'ok', body: deleteSuccessLine },
      { method: 'MCP', path: 'send_email', status: 'ok', body: sendResponseLine },
    ],
  },
];

export function methodBadgeClass(method: ShowcaseMethod): string {
  switch (method) {
    case 'GET':
      return 'bg-emerald-500/20 text-emerald-300';
    case 'POST':
      return 'bg-violet-500/20 text-violet-300';
    case 'DELETE':
      return 'bg-red-500/20 text-red-300';
    case 'MCP':
      return 'bg-amber-500/20 text-amber-300';
  }
}
