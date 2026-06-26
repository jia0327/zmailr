const VERIFICATION_SUBJECT_RE = /(?:otp|verify|verification|验证码)/i;

/** Parse domain from From header value, e.g. `Name <user@example.com>`. */
export function extractSenderDomain(fromAddress: string): string | null {
  const trimmed = fromAddress.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const email = (angleMatch ? angleMatch[1] : trimmed).trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1);
}

export function isVerificationLikeSubject(subject?: string | null): boolean {
  if (!subject) return false;
  return VERIFICATION_SUBJECT_RE.test(subject);
}

export function extractRulesUrl(senderDomain: string | null): string {
  const base = '/dashboard/extract-rules';
  if (!senderDomain) return base;
  return `${base}?domain=${encodeURIComponent(senderDomain)}`;
}
