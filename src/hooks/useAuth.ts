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
  register: (data: RegisterData) => Promise<{ success: boolean; message?: string; emailSent?: boolean; existingUser?: boolean }>;
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
    console.log('🔍 [AUTH] Vérification de l\'authentification...');
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Important pour les cookies
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [AUTH] Utilisateur authentifié:', data.user?.username || 'Non défini');
        setUser(data.user);
        setToken(data.user?.id || null);
      } else {
        // 401 est normal si l'utilisateur n'est pas connecté
        if (response.status === 401) {
          console.log('ℹ️ [AUTH] Non authentifié (401) - normal si pas connecté');
        } else {
          console.warn('⚠️ [AUTH] Erreur lors de la vérification:', response.status, response.statusText);
        }
        setUser(null);
        setToken(null);
      }
    } catch (error) {
      console.error('❌ [AUTH] Erreur réseau lors de la vérification:', error);
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
      console.log('🔵 [AUTH] Vérification terminée, isLoading:', false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    console.log('🔵 [LOGIN] Tentative de connexion pour:', email);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log('📥 [LOGIN] Réponse reçue:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();
      console.log('📥 [LOGIN] Données de la réponse:', data);

      if (!response.ok) {
        console.error('❌ [LOGIN] Échec de la connexion:', data.error);
        setError(data.error || 'Échec de la connexion');
        return false;
      }

      console.log('✅ [LOGIN] Connexion réussie pour:', data.user?.username);
      setUser(data.user);
      setToken(data.user?.id || null);
      await fetchUser(); // Refresh user data
      return true;
    } catch (error) {
      console.error('❌ [LOGIN] Erreur réseau lors de la connexion:', error);
      setError('Échec de la connexion. Veuillez réessayer.');
      return false;
    }
  }, [fetchUser]);

  const register = useCallback(async (registerData: RegisterData): Promise<{ success: boolean; message?: string; emailSent?: boolean; existingUser?: boolean }> => {
    setError(null);
    console.log('📤 [API] Envoi de la requête d\'inscription à /api/auth/register');
    console.log('📤 [API] Données envoyées:', { 
      email: registerData.email, 
      username: registerData.username,
      firstname: registerData.firstname,
      lastname: registerData.lastname 
    });
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout de 30 secondes
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('📥 [API] Réponse reçue:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();
      console.log('📥 [API] Données de la réponse:', data);

      if (!response.ok) {
        console.error('❌ [API] Erreur de l\'API:', data.error);
        setError(data.error || 'Échec de l\'inscription');
        return { success: false, message: data.error };
      }

      console.log('✅ [API] Inscription réussie côté API');
      return { 
        success: true, 
        message: data.message, 
        emailSent: data.emailSent,
        existingUser: data.existingUser || false
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('❌ [API] Timeout de la requête d\'inscription (30s dépassé)');
        setError('La requête prend trop de temps. Vérifiez votre connexion ou réessayez.');
        return { success: false, message: 'Timeout de la requête' };
      }
      console.error('❌ [API] Erreur réseau lors de l\'inscription:', error);
      setError('Échec de l\'inscription. Veuillez réessayer.');
      return { success: false, message: 'Erreur réseau lors de l\'inscription' };
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


