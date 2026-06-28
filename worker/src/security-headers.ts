export type CspProfile = 'none' | 'api' | 'spa' | 'admin';

const API_CSP = "default-src 'none'; frame-ancestors 'none'";

const SPA_CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'unsafe-inline'",
  "connect-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Apply baseline security headers; optional CSP by response profile. */
export function applySecurityHeaders(headers: Headers, profile: CspProfile = 'none'): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (profile === 'api') {
    headers.set('Content-Security-Policy', API_CSP);
  } else if (profile === 'spa') {
    headers.set('Content-Security-Policy', SPA_CSP);
  } else if (profile === 'admin') {
    headers.set('Content-Security-Policy', ADMIN_CSP);
  }
}

export function resolveMainCspProfile(pathname: string, contentType: string | null): CspProfile {
  if (pathname.startsWith('/api/') || pathname === '/openapi.json') {
    return 'api';
  }
  if (contentType?.includes('text/html') && !pathname.startsWith('/docs')) {
    return 'spa';
  }
  return 'none';
}

export function resolveAdminCspProfile(pathname: string, contentType: string | null): CspProfile {
  if (pathname.startsWith('/api/')) {
    return 'api';
  }
  if (contentType?.includes('text/html')) {
    return 'admin';
  }
  return 'none';
}
