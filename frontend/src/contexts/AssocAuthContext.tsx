import { createContext, useContext, useState, ReactNode } from 'react';
import { assocApi, setAssocToken, clearAssocToken } from '../lib/assocApi';

export interface AssocUser {
  associationId: string;
  role: 'ADMIN' | 'OPERATOR';
}

interface AssocAuthContextValue {
  user: AssocUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AssocAuthContext = createContext<AssocAuthContextValue>(null!);

const ASSOC_USER_KEY = 'assoc_user';

export function AssocAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AssocUser | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(ASSOC_USER_KEY) || 'null');
    } catch {
      return null;
    }
  });

  const login = async (username: string, password: string) => {
    const res = await assocApi.login(username, password);
    setAssocToken(res.token);
    const u: AssocUser = {
      associationId: res.associationId,
      role: res.role as 'ADMIN' | 'OPERATOR',
    };
    setUser(u);
    localStorage.setItem(ASSOC_USER_KEY, JSON.stringify(u));
  };

  const logout = () => {
    clearAssocToken();
    localStorage.removeItem(ASSOC_USER_KEY);
    setUser(null);
  };

  return (
    <AssocAuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AssocAuthContext.Provider>
  );
}

export function useAssocAuth() {
  return useContext(AssocAuthContext);
}
