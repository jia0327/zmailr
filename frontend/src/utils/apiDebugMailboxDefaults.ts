import type { ApiEndpointDef } from './apiDebugEndpoints';
import { getLastLease } from './apiLeaseSession';
import { getUserMailboxes } from './api';
import { getDefaultEmailDomain } from '../config';

export interface MailboxDefaults {
  localPart: string;
  fullEmail: string;
}

function fullAddress(localPart: string, domain: string, email?: string): string {
  if (email?.includes('@')) return email;
  return `${localPart}@${domain}`;
}

export async function resolveMailboxDefaults(
  userId: number,
  contextLocalPart?: string | null
): Promise<MailboxDefaults | null> {
  const domain = await getDefaultEmailDomain();
  let localPart: string | null = contextLocalPart?.trim() || null;
  let email: string | undefined;

  if (!localPart) {
    const result = await getUserMailboxes();
    if (result.success && result.mailboxes.length > 0) {
      const first = result.mailboxes[0];
      localPart = first.address;
      email = first.email;
    }
  }

  if (!localPart) {
    const lease = getLastLease(userId);
    if (lease) {
      localPart = lease.address;
      email = lease.email;
    }
  }

  if (!localPart) return null;

  return {
    localPart,
    fullEmail: fullAddress(localPart, domain, email),
  };
}

/** Apply mailbox defaults to endpoint field values. */
export function applyMailboxDefaults(
  endpoint: ApiEndpointDef,
  values: Record<string, string>,
  defaults: MailboxDefaults,
  onlyEmpty = true
): Record<string, string> {
  const result = { ...values };

  const setField = (name: string, value: string) => {
    if (onlyEmpty && (result[name] ?? '').trim()) return;
    result[name] = value;
  };

  for (const field of endpoint.fields) {
    if (field.name === 'address' && field.kind === 'path') {
      setField('address', defaults.localPart);
    } else if (field.name === 'to' && field.kind === 'query') {
      setField('to', defaults.fullEmail);
    } else if (field.name === 'from' && field.kind === 'body') {
      setField('from', defaults.fullEmail);
    }
  }

  return result;
}
