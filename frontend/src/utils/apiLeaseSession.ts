const STORAGE_KEY = 'zmail_last_lease';

export interface LastLease {
  address: string;
  email: string;
}

type UserLeaseStore = Record<string, LastLease>;

function readStore(): UserLeaseStore {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: UserLeaseStore) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function saveLastLease(userId: number, lease: LastLease) {
  const store = readStore();
  store[String(userId)] = lease;
  writeStore(store);
}

export function getLastLease(userId: number): LastLease | null {
  const lease = readStore()[String(userId)];
  if (!lease?.address) return null;
  return lease;
}
