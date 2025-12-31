'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  balance: number;
  gamesPlayed: number;
  gamesWon: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getToken: () => string | null;
}

interface RegisterData {
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(data.user?.id || null);
      } else {
        setUser(null);
        setToken(null);
      }
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        return false;
      }

      setUser(data.user);
      setToken(data.user?.id || null);
      await fetchUser(); // Refresh user data
      return true;
    } catch {
      setError('Login failed. Please try again.');
      return false;
    }
  }, []);

  const register = useCallback(async (registerData: RegisterData): Promise<{ success: boolean; message?: string }> => {
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return { success: false, message: data.error };
      }

      return { success: true, message: data.message };
    } catch {
      setError('Registration failed. Please try again.');
      return { success: false, message: 'Registration failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors
    }
    setUser(null);
    setToken(null);
  }, []);

  const getToken = useCallback(() => user?.id || null, [user]);

  return {
    user,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser: fetchUser,
    getToken,
    AuthContext,
    AuthContextValue: {
      user,
      isLoading,
      error,
      login,
      register,
      logout,
      refreshUser: fetchUser,
      getToken,
    },
  };
}

export { AuthContext };
export type { User, AuthContextType };


