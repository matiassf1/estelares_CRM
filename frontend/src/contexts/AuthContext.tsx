import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api.ts';

interface AuthUser {
  type: string;
  nombre?: string;
  apellido?: string;
  username?: string;
  dni?: string;
  patente?: string;
  foto_url?: string;
  estacionamiento?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (dni: string, password: string) => Promise<void>;
  adminLogin: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

const CACHE_KEY = 'estelares_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.me()
      .then(u => { setUser(u); localStorage.setItem(CACHE_KEY, JSON.stringify(u)); })
      .catch(() => {
        // Keep cached user if offline so the carnet still works
        if (!navigator.onLine) return;
        localStorage.removeItem('token');
        localStorage.removeItem(CACHE_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (dni: string, password: string) => {
    const { token } = await api.login(dni, password);
    localStorage.setItem('token', token);
    const me = await api.me();
    setUser(me);
    localStorage.setItem(CACHE_KEY, JSON.stringify(me));
  };

  const adminLogin = async (username: string, password: string) => {
    const { token, user: u } = await api.adminLogin(username, password);
    localStorage.setItem('token', token);
    setUser({ type: u.role, username: u.username });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem(CACHE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
