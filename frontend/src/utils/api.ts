import { API_BASE_URL } from "../config";

// API请求基础URL
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const fetchOpts = { credentials: 'include' as RequestCredentials };

export interface UserMailboxItem {
  id: string;
  address: string;
  email?: string;
  createdAt: number;
  expiresAt: number;
  ipAddress: string;
  lastAccessed: number;
  isExpired?: boolean;
}

export const getUserMailboxes = async (includeExpired = false) => {
  try {
    const query = includeExpired ? '?includeExpired=true' : '';
    const response = await fetch(apiUrl(`/api/user/mailboxes${query}`), fetchOpts);
    if (response.status === 401) return { success: false as const, error: 'Unauthorized' };
    const data = await response.json();
    if (data.success) {
      return { success: true as const, mailboxes: data.mailboxes as UserMailboxItem[] };
    }
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const reactivateUserMailbox = async (address: string) => {
  try {
    const response = await fetch(apiUrl(`/api/user/mailboxes/${encodeURIComponent(address)}/reactivate`), {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (data.success) return { success: true as const, mailbox: data.mailbox as UserMailboxItem };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const deleteUserEmails = async (params: {
  mailboxAddress: string;
  ids?: string[];
  all?: boolean;
}) => {
  try {
    const response = await fetch(apiUrl('/api/user/emails'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.success) return { success: true as const, deleted: data.deleted as number };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const deleteUserSentEmails = async (params: { ids?: number[]; all?: boolean }) => {
  try {
    const response = await fetch(apiUrl('/api/user/sent'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.success) return { success: true as const, deleted: data.deleted as number };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const createUserMailbox = async (address?: string) => {
  try {
    const response = await fetch(apiUrl('/api/user/mailboxes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(address ? { address } : {}),
    });
    const data = await response.json();
    if (data.success) return { success: true as const, mailbox: data.mailbox };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

/** @deprecated Use createUserMailbox — anonymous POST /api/mailboxes is disabled */
export const createRandomMailbox = createUserMailbox;

/** @deprecated Use createUserMailbox — anonymous POST /api/mailboxes is disabled */
export const createCustomMailbox = async (address: string) => {
  if (!address.trim()) {
    return { success: false as const, error: 'Invalid address' };
  }
  return createUserMailbox(address.trim());
};

// 获取邮箱信息
export const getMailbox = async (address: string) => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${address}`), fetchOpts);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Mailbox not found' };
      }
      if (response.status === 401) {
        return { success: false, error: 'Unauthorized' };
      }
      throw new Error('Failed to fetch mailbox');
    }
    
    const data = await response.json();
    if (data.success) {
      return { success: true, mailbox: data.mailbox };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error fetching mailbox:', error);
    return { success: false, error };
  }
};

// 获取邮件列表
export const getEmails = async (address: string) => {
  try {
    if (!address) {
      return { success: false, error: 'Address is empty', emails: [] };
    }
    
    const response = await fetch(apiUrl(`/api/mailboxes/${address}/emails`), fetchOpts);
    
    if (response.status === 404) {
      return { success: false, error: 'Mailbox not found', notFound: true };
    }

    if (response.status === 401) {
      return { success: false, error: 'Unauthorized', emails: [] };
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, emails: data.emails };
    } else {
      if (data.error && (data.error.includes('邮箱不存在') || data.error.includes('Mailbox not found'))) {
        return { success: false, error: data.error, notFound: true };
      }
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    return { success: false, error, emails: [] };
  }
};

// 删除邮箱
export const deleteMailbox = async (address: string) => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${address}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (response.status === 401) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!response.ok) {
      throw new Error('Failed to delete mailbox');
    }
    
    const data = await response.json();
    if (data.success) {
      return { success: true };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error deleting mailbox:', error);
    return { success: false, error };
  }
};

// 保存邮箱信息到本地存储
export const saveMailboxToLocalStorage = (mailbox: Mailbox) => {
  localStorage.setItem('tempMailbox', JSON.stringify({
    ...mailbox,
    savedAt: Date.now() / 1000
  }));
};

// 从本地存储获取邮箱信息
export const getMailboxFromLocalStorage = (): Mailbox | null => {
  const savedMailbox = localStorage.getItem('tempMailbox');
  if (!savedMailbox) return null;
  
  try {
    const mailbox = JSON.parse(savedMailbox) as Mailbox & { savedAt: number };
    const now = Date.now() / 1000;
    
    if (mailbox.expiresAt < now) {
      localStorage.removeItem('tempMailbox');
      return null;
    }
    
    return mailbox;
  } catch (error) {
    localStorage.removeItem('tempMailbox');
    return null;
  }
};

// 从本地存储删除邮箱信息
export const removeMailboxFromLocalStorage = () => {
  localStorage.removeItem('tempMailbox');
};

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  dailySendQuota: number;
  sendCountToday?: number;
  sendRemaining?: number;
}

export interface AuthUsage {
  sendCount: number;
  leaseCount: number;
  usageDate: string;
  sendRemaining?: number;
}

export interface AuthTokenSummary {
  id: number;
  name: string | null;
  scopes: string[];
  expiresAt: number;
}

export interface AuthStats {
  mailboxesCount: number;
  messagesReceivedCount: number;
  customRulesCount: number;
  token: AuthTokenSummary | null;
}

export const authLogin = async (username: string, password: string) => {
  try {
    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (data.success) return { success: true as const };
    return { success: false as const, error: data.error || 'Login failed' };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const authLogout = async () => {
  await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
};

export const authMe = async (): Promise<{
  success: boolean;
  user?: AuthUser;
  usage?: AuthUsage;
  stats?: AuthStats;
}> => {
  try {
    const response = await fetch(apiUrl('/api/auth/me'), fetchOpts);
    if (response.status === 401) return { success: false };
    const data = await response.json();
    if (data.success) {
      return {
        success: true,
        user: data.user,
        usage: data.usage,
        stats: data.stats,
      };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
};

export interface UserTokenItem {
  id: number;
  name: string | null;
  scopes: string[];
  expiresAt: number;
  createdAt: number;
  lastUsedAt: number | null;
}

export const createUserToken = async (params: {
  name?: string;
  expiresInDays: number;
  scopes: string[];
}) => {
  try {
    const response = await fetch(apiUrl('/api/user/tokens'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.success) return { success: true as const, token: data.token };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const deleteUserToken = async (id: number) => {
  await fetch(apiUrl(`/api/user/tokens/${id}`), {
    method: 'DELETE',
    credentials: 'include',
  });
};

export const sendUserEmail = async (params: {
  to: string;
  subject: string;
  text: string;
  from?: string;
}) => {
  try {
    const response = await fetch(apiUrl('/api/user/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.success) return { success: true as const };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export interface SentEmailItem {
  id: number;
  toEmail: string;
  subject: string;
  status: string;
  createdAt: number;
}

export const getUserSentEmails = async (limit = 50) => {
  try {
    const response = await fetch(apiUrl(`/api/user/sent?limit=${limit}`), fetchOpts);
    if (response.status === 401) return { success: false as const, error: 'Unauthorized' };
    const data = await response.json();
    if (data.success) return { success: true as const, emails: data.emails as SentEmailItem[] };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export interface ExtractRuleItem {
  id: number;
  domain: string;
  regex: string;
  priority: number;
  enabled: boolean;
  createdAt?: number;
  remark?: string | null;
}

export type GlobalExtractRuleItem = ExtractRuleItem;

function stripSeedRemarkPrefix(remark: string | null | undefined): string {
  if (!remark) return '-';
  return remark.replace(/^\[seed:[^\]]+\]\s*/, '');
}

export const getUserExtractRules = async () => {
  try {
    const response = await fetch(apiUrl('/api/user/extract-rules'), fetchOpts);
    if (response.status === 401) return { success: false as const, error: 'Unauthorized' };
    const data = await response.json();
    if (data.success) {
      return {
        success: true as const,
        rules: data.rules as ExtractRuleItem[],
        globalRules: data.globalRules as GlobalExtractRuleItem[],
      };
    }
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export { stripSeedRemarkPrefix };

export const createUserExtractRule = async (params: {
  domain: string;
  regex: string;
  priority: number;
  enabled: boolean;
  remark?: string | null;
}) => {
  try {
    const response = await fetch(apiUrl('/api/user/extract-rules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.success) return { success: true as const, rule: data.rule as ExtractRuleItem };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const updateUserExtractRule = async (
  id: number,
  params: { domain: string; regex: string; priority: number; enabled: boolean; remark?: string | null }
) => {
  try {
    const response = await fetch(apiUrl(`/api/user/extract-rules/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    });
    const data = await response.json();
    if (data.success) return { success: true as const, rule: data.rule as ExtractRuleItem };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const deleteUserExtractRule = async (id: number) => {
  try {
    const response = await fetch(apiUrl(`/api/user/extract-rules/${id}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await response.json();
    if (data.success) return { success: true as const };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt?: number | null;
  enabled?: boolean;
}

export const getUnreadAnnouncements = async () => {
  try {
    const response = await fetch(apiUrl('/api/user/announcements/unread'), fetchOpts);
    if (response.status === 401) return { success: false as const, error: 'Unauthorized' };
    const data = await response.json();
    if (data.success) {
      return { success: true as const, announcements: data.announcements as AnnouncementItem[] };
    }
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const markAnnouncementRead = async (id: number) => {
  try {
    const response = await fetch(apiUrl(`/api/user/announcements/${id}/read`), {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (data.success) return { success: true as const };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};

export const markAllAnnouncementsRead = async () => {
  try {
    const response = await fetch(apiUrl('/api/user/announcements/read-all'), {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (data.success) return { success: true as const, marked: data.marked as number };
    return { success: false as const, error: data.error };
  } catch {
    return { success: false as const, error: 'Network error' };
  }
};
