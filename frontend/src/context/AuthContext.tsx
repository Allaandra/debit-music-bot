import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api } from '../services/api';

export interface AuthContextValue {
  user: User | null;
  loadingUser: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    api.fetchMe()
      .then((data: any) => {
        if (data && !data.error) {
          setUser(data);
        }
        setLoadingUser(false);
      })
      .catch((e: any) => {
        console.error('Failed to fetch user', e);
        setLoadingUser(false);
      });
  }, []);

  const logout = async () => {
    await api.logout();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loadingUser, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
