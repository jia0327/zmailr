import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authLogin, authLogout, authMe, AuthUser, AuthUsage } from '../utils/api';

interface AuthContextValue {
  user: AuthUser | null;
  usage: AuthUsage | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<AuthUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const result = await authMe();
    if (result.success && result.user) {
      setUser(result.user);
      setUsage(result.usage ?? null);
    } else {
      setUser(null);
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const result = await authLogin(username, password);
    if (result.success) {
      await refresh();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = async () => {
    await authLogout();
    setUser(null);
    setUsage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        usage,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
