import { API_BASE_URL } from "../config";

// API请求基础URL
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

// 创建随机邮箱
export const createRandomMailbox = async (expiresInHours = 24) => {
  try {
    const requestBody = JSON.stringify({
      expiresInHours,
    });
    
    const response = await fetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });
    
    if (!response.ok) {
      throw new Error('Failed to create mailbox');
    }
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, mailbox: data.mailbox };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    return { success: false, error };
  }
};

// 创建自定义邮箱
export const createCustomMailbox = async (address: string, expiresInHours = 24) => {
  try {
    if (!address.trim()) {
      return { success: false, error: 'Invalid address' };
    }
    
    const response = await fetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address.trim(),
        expiresInHours,
      }),
    });
    
    // 尝试解析响应内容
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 400) {
        // 使用后端返回的错误信息
        return { success: false, error: data.error || 'Address already exists' };
      }
      throw new Error(data.error || 'Failed to create mailbox');
    }
    
    if (data.success) {
      return { success: true, mailbox: data.mailbox };
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error creating custom mailbox:', error);
    return { success: false, error };
  }
};

// 获取邮箱信息
export const getMailbox = async (address: string) => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${address}`));
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Mailbox not found' };
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
    // 检查地址是否为空
    if (!address) {
      return { success: false, error: 'Address is empty', emails: [] };
    }
    
    const response = await fetch(apiUrl(`/api/mailboxes/${address}/emails`));
    
    // 直接处理404状态码
    if (response.status === 404) {
      return { success: false, error: 'Mailbox not found', notFound: true };
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return { success: true, emails: data.emails };
    } else {
      // 检查错误信息是否包含"邮箱不存在"
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
    });
    
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
    
    // 检查邮箱是否过期
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

const fetchOpts = { credentials: 'include' as RequestCredentials };

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
}> => {
  try {
    const response = await fetch(apiUrl('/api/auth/me'), fetchOpts);
    if (response.status === 401) return { success: false };
    const data = await response.json();
    if (data.success) {
      return { success: true, user: data.user, usage: data.usage };
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