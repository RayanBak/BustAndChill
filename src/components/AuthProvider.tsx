'use client';

import { ReactNode } from 'react';
import { useAuth, AuthContext } from '@/hooks/useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth.AuthContextValue}>
      {children}
    </AuthContext.Provider>
  );
}


