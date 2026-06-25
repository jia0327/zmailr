const STORAGE_KEY = 'zmail_api_tokens';
const LEGACY_SESSION_KEY = 'zmail_api_token';

type TokenMap = Record<string, string>;
type UserTokenStore = Record<string, TokenMap>;

function readStore(): UserTokenStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: UserTokenStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function userKey(userId: number) {
  return String(userId);
}

export function getStoredToken(userId: number, tokenId: number): string | null {
  return readStore()[userKey(userId)]?.[String(tokenId)] ?? null;
}

export function saveStoredToken(userId: number, tokenId: number, token: string) {
  const store = readStore();
  const key = userKey(userId);
  if (!store[key]) store[key] = {};
  store[key][String(tokenId)] = token;
  writeStore(store);
}

export function removeStoredToken(userId: number, tokenId: number) {
  const store = readStore();
  const key = userKey(userId);
  if (!store[key]) return;
  delete store[key][String(tokenId)];
  if (Object.keys(store[key]).length === 0) delete store[key];
  writeStore(store);
}

export function loadStoredTokens(userId: number, tokenIds: number[]): Record<number, string> {
  const userTokens = readStore()[userKey(userId)] ?? {};
  const result: Record<number, string> = {};
  for (const id of tokenIds) {
    const token = userTokens[String(id)];
    if (token) result[id] = token;
  }
  return result;
}

export function pruneStoredTokens(userId: number, validTokenIds: number[]) {
  const store = readStore();
  const key = userKey(userId);
  const userTokens = store[key];
  if (!userTokens) return;

  const valid = new Set(validTokenIds.map(String));
  for (const tokenId of Object.keys(userTokens)) {
    if (!valid.has(tokenId)) delete userTokens[tokenId];
  }

  if (Object.keys(userTokens).length === 0) {
    delete store[key];
  } else {
    store[key] = userTokens;
  }
  writeStore(store);
}

/** One-time migration from sessionStorage (pre-localStorage copy feature). */
export function migrateLegacySessionTokens(userId: number, tokenIds: number[]) {
  try {
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as TokenMap;
    if (!parsed || typeof parsed !== 'object') return;

    let migrated = false;
    for (const id of tokenIds) {
      const token = parsed[String(id)];
      if (token) {
        saveStoredToken(userId, id, token);
        migrated = true;
      }
    }
    if (migrated) sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // ignore corrupt legacy data
  }
}

/** @deprecated Use getStoredToken(userId, tokenId) */
export function getSessionToken(tokenId: number): string | null {
  try {
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenMap;
    return parsed?.[String(tokenId)] ?? null;
  } catch {
    return null;
  }
}

/** @deprecated Use saveStoredToken(userId, tokenId, token) */
export function saveSessionToken(tokenId: number, token: string) {
  try {
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    const tokens: TokenMap = raw ? JSON.parse(raw) : {};
    tokens[String(tokenId)] = token;
    sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(tokens));
  } catch {
    // ignore
  }
}

/** @deprecated Use removeStoredToken(userId, tokenId) */
export function removeSessionToken(tokenId: number) {
  try {
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return;
    const tokens = JSON.parse(raw) as TokenMap;
    delete tokens[String(tokenId)];
    sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(tokens));
  } catch {
    // ignore
  }
}
