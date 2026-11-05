/* oxlint-disable react/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api, apiClient } from '../services/api';

export interface AuthContextValue {
  user: User | null;
  loadingUser: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const checkAuth = async () => {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await apiClient.get('/auth/me');
        if (res.data && !res.data.error) {
          setUser(res.data);
        } else {
          setUser(null);
        }
        setLoadingUser(false);
        return;
      } catch (err: any) {
        if (err?.response?.status === 401) {
          setUser(null);
          setLoadingUser(false);
          return;
        }

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    }
    setUser(null);
    setLoadingUser(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const logout = async () => {
    await api.logout();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loadingUser, setUser, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
