import { DEFAULT_EMAIL_DOMAIN, formatMailboxEmail } from '../config';
import type { UserMailboxItem } from './api';

type MailboxLike = {
  address: string;
  mailDomain?: string | null;
  email?: string;
};

export function getMailboxLocalPart(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return '';
  return trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
}

export function getMailboxDomain(mailbox: MailboxLike, fallback = DEFAULT_EMAIL_DOMAIN): string {
  const fromField = mailbox.mailDomain?.trim();
  if (fromField) return fromField;
  const email = mailbox.email?.trim();
  if (email?.includes('@')) {
    return email.slice(email.indexOf('@') + 1);
  }
  return fallback;
}

export function mailboxIdentityKey(mailbox: MailboxLike, fallback = DEFAULT_EMAIL_DOMAIN): string {
  const localPart = getMailboxLocalPart(mailbox.address);
  const domain = getMailboxDomain(mailbox, fallback).toLowerCase();
  return `${localPart.toLowerCase()}@${domain}`;
}

export function isSameMailbox(
  a: MailboxLike,
  b: MailboxLike,
  fallback = DEFAULT_EMAIL_DOMAIN
): boolean {
  return mailboxIdentityKey(a, fallback) === mailboxIdentityKey(b, fallback);
}

export function formatMailboxDisplayEmail(mailbox: MailboxLike, fallback = DEFAULT_EMAIL_DOMAIN): string {
  if (mailbox.email?.includes('@')) return mailbox.email;
  const localPart = getMailboxLocalPart(mailbox.address);
  const domain = getMailboxDomain(mailbox, fallback);
  return formatMailboxEmail(
    {
      id: '',
      address: localPart,
      createdAt: 0,
      expiresAt: 0,
      lastAccessed: 0,
      mailDomain: domain,
      email: mailbox.email,
    },
    fallback
  );
}

export function userMailboxItemToMailbox(mb: UserMailboxItem): Mailbox {
  const localPart = getMailboxLocalPart(mb.address);
  const mailDomain = mb.mailDomain?.trim() || getMailboxDomain(mb);
  return {
    id: mb.id,
    address: localPart,
    createdAt: mb.createdAt,
    expiresAt: mb.expiresAt,
    ipAddress: mb.ipAddress,
    lastAccessed: mb.lastAccessed,
    mailDomain,
    email: mb.email ?? formatMailboxDisplayEmail({ address: localPart, mailDomain, email: mb.email }),
  };
}

export function pickRandomDomain(domains: string[], exclude?: string): string {
  if (!domains.length) return exclude ?? DEFAULT_EMAIL_DOMAIN;
  const pool =
    exclude && domains.length > 1 ? domains.filter((d) => d !== exclude) : domains;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function mailboxCacheKey(mailbox: MailboxLike, fallback = DEFAULT_EMAIL_DOMAIN): string {
  return mailboxIdentityKey(mailbox, fallback);
}
