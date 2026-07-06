import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthResponse, setAuthTokenGetter, setTokenRefreshHandler } from '@workspace/api-client-react';

const TOKEN_KEY = 'cmd_token';
const REFRESH_KEY = 'cmd_refresh';
const USER_KEY = 'cmd_user';

// Wire the API client to read the stored access token from localStorage on every request.
// This must run once at module load, before any authenticated query fires.
setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));

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

  // Persist a successful login — stores both access and refresh tokens.
  const login = useCallback((data: AuthResponse) => {
    setUser(data.user);
    setToken(data.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }, []);

  // Register the 401 auto-refresh handler with the API client.
  // The handler is called whenever a request returns 401; it uses the stored
  // refresh token to obtain a new access token, updates localStorage/state,
  // and returns the new token so the original request can be retried.
  useEffect(() => {
    setTokenRefreshHandler(async () => {
      const storedRefresh = localStorage.getItem(REFRESH_KEY);
      if (!storedRefresh) return null;

      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefresh }),
        });
        if (!res.ok) throw new Error('Refresh failed');
        const data: AuthResponse = await res.json();
        // Update persisted tokens and React state.
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        localStorage.setItem(REFRESH_KEY, data.refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
        setToken(data.accessToken);
        return data.accessToken;
      } catch {
        // Refresh failed — clear session and force re-login.
        logout();
        return null;
      }
    });

    return () => {
      // Clear the handler when the provider unmounts (edge case: hot reload).
      setTokenRefreshHandler(null);
    };
  }, [logout]);

  // Restore session from localStorage on first mount.
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
      }
    }
    setIsReady(true);
  }, []);

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
