import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from './api';
import type { User } from './types';

export type RegisterData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  barangayId: number;
  birthDate?: string;
  sex?: string;
  contactNumber?: string;
  purok?: string;
  address?: string;
};

type AuthValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

function readUser(): User | null {
  try {
    return localStorage.getItem('token') ? JSON.parse(localStorage.getItem('user') ?? 'null') : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser);

  const save = (r: { token: string; user: User }) => {
    if (r.user.role !== 'resident') throw new Error('This app is for residents. Admins use the web portal.');
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    setUser(r.user);
  };

  const value: AuthValue = {
    user,
    login: async (email, password) => save(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (data) => save(await api('/auth/register', { method: 'POST', body: data })),
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
