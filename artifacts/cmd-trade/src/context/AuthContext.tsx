import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse, setAuthTokenGetter } from '@workspace/api-client-react';

// Wire the API client to read the stored token from localStorage on every request.
// This must run once at module load, before any authenticated query fires.
setAuthTokenGetter(() => localStorage.getItem('cmd_token'));

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('cmd_user');
    const storedToken = localStorage.getItem('cmd_token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (e) {
        localStorage.removeItem('cmd_user');
        localStorage.removeItem('cmd_token');
      }
    }
    setIsReady(true);
  }, []);

  const login = (data: AuthResponse) => {
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem('cmd_user', JSON.stringify(data.user));
    localStorage.setItem('cmd_token', data.accessToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('cmd_user');
    localStorage.removeItem('cmd_token');
  };

  if (!isReady) return null;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
