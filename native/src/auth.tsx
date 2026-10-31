import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from './api';
import type { SessionUser } from './api';
import { readStore, removeStore, writeStore } from './store';

type AuthValue = {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (body: { email: string; password: string; firstName: string; lastName: string; language: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.bindSession((payload) => {
      if (payload) void writeStore('rohi_refresh', payload.refreshToken);
      else void removeStore('rohi_refresh');
    });
    void (async () => {
      try {
        const token = await readStore('rohi_refresh');
        const restored = await api.restore(token);
        setUser(restored);
      } catch {
        setUser(null);
        await removeStore('rohi_refresh');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value: AuthValue = {
    user,
    ready,
    async login(email, password) {
      setUser(await api.login(email, password));
    },
    async register(body) {
      setUser(await api.register(body));
    },
    async logout() {
      await api.logout();
      setUser(null);
    },
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('auth');
  return value;
}
