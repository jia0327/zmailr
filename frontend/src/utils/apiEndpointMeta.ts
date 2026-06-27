import type { ApiEndpointDef, EndpointField, FieldKind } from './apiDebugEndpoints';
import { getEndpointById } from './apiDebugEndpoints';

export interface EndpointMeta {
  docsSection: string;
  docsAnchor: string;
  titleKey: string;
  descriptionKey: string;
  usageHintKey: string;
}

/** Maps debug endpoint id → shared documentation metadata (i18n keys). */
export const ENDPOINT_META: Record<string, EndpointMeta> = {
  'user-quota': {
    docsSection: 'quota',
    docsAnchor: 'user-quota',
    titleKey: 'apiDocs.quota.title',
    descriptionKey: 'apiDocs.quota.description',
    usageHintKey: 'apiDocs.quota.usageHint',
  },
  lease: {
    docsSection: 'lease',
    docsAnchor: 'lease',
    titleKey: 'apiDocs.lease.title',
    descriptionKey: 'apiDocs.lease.description',
    usageHintKey: 'apiDocs.lease.usageHint',
  },
  'mailboxes-list': {
    docsSection: 'listMailboxes',
    docsAnchor: 'list-mailboxes',
    titleKey: 'apiDocs.listMailboxes.title',
    descriptionKey: 'apiDocs.listMailboxes.description',
    usageHintKey: 'apiDocs.listMailboxes.usageHint',
  },
  'mailboxes-delete': {
    docsSection: 'mailboxOps',
    docsAnchor: 'delete-mailbox',
    titleKey: 'apiDocs.mailboxOps.deleteTitle',
    descriptionKey: 'apiDocs.mailboxOps.description',
    usageHintKey: 'apiDocs.mailboxOps.usageHint',
  },
  'mailboxes-latest-code': {
    docsSection: 'latestCode',
    docsAnchor: 'latest-code',
    titleKey: 'apiDocs.latestCode.title',
    descriptionKey: 'apiDocs.latestCode.description',
    usageHintKey: 'apiDocs.latestCode.usageHint',
  },
  'mailboxes-latest-link': {
    docsSection: 'latestLink',
    docsAnchor: 'latest-link',
    titleKey: 'apiDocs.latestLink.title',
    descriptionKey: 'apiDocs.latestLink.description',
    usageHintKey: 'apiDocs.latestLink.usageHint',
  },
  'mail-poll': {
    docsSection: 'mail',
    docsAnchor: 'mail',
    titleKey: 'apiDocs.mail.title',
    descriptionKey: 'apiDocs.mail.description',
    usageHintKey: 'apiDocs.mail.usageHint',
  },
  send: {
    docsSection: 'send',
    docsAnchor: 'send',
    titleKey: 'apiDocs.send.title',
    descriptionKey: 'apiDocs.send.description',
    usageHintKey: 'apiDocs.send.usageHint',
  },
  'emails-get': {
    docsSection: 'emailDetail',
    docsAnchor: 'email-detail',
    titleKey: 'apiDocs.emailDetail.title',
    descriptionKey: 'apiDocs.emailDetail.description',
    usageHintKey: 'apiDocs.emailDetail.usageHint',
  },
  'emails-raw': {
    docsSection: 'rawEmail',
    docsAnchor: 'raw-email',
    titleKey: 'apiDocs.rawEmail.title',
    descriptionKey: 'apiDocs.rawEmail.description',
    usageHintKey: 'apiDocs.rawEmail.usageHint',
  },
};

/** Per-endpoint field name → i18n description key. */
const FIELD_DESCRIPTION_KEYS: Record<string, Record<string, string>> = {
  'mailboxes-list': {
    limit: 'apiDocs.listMailboxes.params.limit',
  },
  'mailboxes-delete': {
    address: 'apiDocs.mailboxOps.params.address',
  },
  'mailboxes-latest-code': {
    address: 'apiDocs.latestCode.params.address',
  },
  'mailboxes-latest-link': {
    address: 'apiDocs.latestLink.params.address',
  },
  'mail-poll': {
    to: 'apiDocs.mail.params.to',
    timeout: 'apiDocs.mail.params.timeout',
    since: 'apiDocs.mail.params.since',
    require_code: 'apiDocs.mail.params.requireCode',
  },
  send: {
    to: 'apiDocs.send.params.to',
    subject: 'apiDocs.send.params.subject',
    text: 'apiDocs.send.params.body',
    from: 'apiDocs.send.params.from',
  },
  'emails-get': {
    id: 'apiDocs.emailDetail.params.id',
  },
  'emails-raw': {
    id: 'apiDocs.rawEmail.params.id',
  },
};

export interface ParamDocRow {
  name: string;
  type: string;
  required: boolean;
  descriptionKey: string;
  kind: FieldKind;
}

export function getEndpointMeta(endpointId: string): EndpointMeta | undefined {
  return ENDPOINT_META[endpointId];
}

export function getEndpointDescriptionKey(endpointId: string): string {
  return ENDPOINT_META[endpointId]?.descriptionKey ?? 'apiEndpointMeta.unknownParam';
}

export function getDocsHref(endpointId: string): string {
  const anchor = ENDPOINT_META[endpointId]?.docsAnchor;
  return anchor ? `/api-docs#${anchor}` : '/api-docs';
}

export function getParamRows(endpoint: ApiEndpointDef): ParamDocRow[] {
  const descKeys = FIELD_DESCRIPTION_KEYS[endpoint.id] ?? {};
  return endpoint.fields.map((field) => ({
    name: field.name,
    type: field.type,
    required: !!field.required,
    descriptionKey: descKeys[field.name] ?? `apiEndpointMeta.unknownParam`,
    kind: field.kind,
  }));
}

export function getParamRowsByEndpointId(endpointId: string): ParamDocRow[] {
  const endpoint = getEndpointById(endpointId);
  if (!endpoint) return [];
  return getParamRows(endpoint);
}

export function fieldDescriptionKey(endpointId: string, field: EndpointField): string {
  return FIELD_DESCRIPTION_KEYS[endpointId]?.[field.name] ?? 'apiEndpointMeta.unknownParam';
}
