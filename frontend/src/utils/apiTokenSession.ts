const SESSION_TOKEN_KEY = 'zmail_api_token';

type SessionTokenMap = Record<string, string>;

function readSessionTokens(): SessionTokenMap {
  try {
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionTokens(tokens: SessionTokenMap) {
  sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(tokens));
}

export function getSessionToken(tokenId: number): string | null {
  return readSessionTokens()[String(tokenId)] ?? null;
}

export function saveSessionToken(tokenId: number, token: string) {
  const tokens = readSessionTokens();
  tokens[String(tokenId)] = token;
  writeSessionTokens(tokens);
}

export function removeSessionToken(tokenId: number) {
  const tokens = readSessionTokens();
  delete tokens[String(tokenId)];
  writeSessionTokens(tokens);
}
