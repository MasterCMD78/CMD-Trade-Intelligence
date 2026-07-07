import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthResponse, setAuthTokenGetter, setTokenRefreshHandler } from '@workspace/api-client-react';
import { storage } from '@/lib/storage';

const TOKEN_KEY = 'cmd_token';
const REFRESH_KEY = 'cmd_refresh';
const USER_KEY = 'cmd_user';

// Wire the API client to read the stored access token from localStorage on
// every request.  Uses the safe storage wrapper so this never throws even in
// sandboxed iframe contexts.
setAuthTokenGetter(() => storage.get(TOKEN_KEY));

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Loading screen ───────────────────────────────────────────────────────────
// Shown for the brief moment between the first render and the session-restore
// effect — prevents a blank white flash.
function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-xs font-mono tracking-widest uppercase">
          Initialising…
        </p>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Persist a successful login — stores both access and refresh tokens.
  const login = useCallback((data: AuthResponse) => {
    setUser(data.user);
    setToken(data.accessToken);
    storage.set(USER_KEY, JSON.stringify(data.user));
    storage.set(TOKEN_KEY, data.accessToken);
    storage.set(REFRESH_KEY, data.refreshToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    storage.clear(USER_KEY, TOKEN_KEY, REFRESH_KEY);
  }, []);

  // Register the 401 auto-refresh handler with the API client.
  useEffect(() => {
    setTokenRefreshHandler(async () => {
      const storedRefresh = storage.get(REFRESH_KEY);
      if (!storedRefresh) return null;

      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefresh }),
        });
        if (!res.ok) throw new Error('Refresh failed');
        const data: AuthResponse = await res.json();
        storage.set(TOKEN_KEY, data.accessToken);
        storage.set(REFRESH_KEY, data.refreshToken);
        storage.set(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
        setToken(data.accessToken);
        return data.accessToken;
      } catch {
        logout();
        return null;
      }
    });

    return () => {
      setTokenRefreshHandler(null);
    };
  }, [logout]);

  // Restore session from storage on first mount.
  // Always calls setIsReady(true) — even on error — so the app never hangs.
  useEffect(() => {
    try {
      const storedUser = storage.get(USER_KEY);
      const storedToken = storage.get(TOKEN_KEY);
      if (storedUser && storedToken) {
        const parsed = JSON.parse(storedUser) as User;
        setUser(parsed);
        setToken(storedToken);
      }
    } catch {
      // Malformed storage — clear it and start fresh.
      storage.clear(USER_KEY, TOKEN_KEY, REFRESH_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  // Show a loading screen instead of null — prevents a blank white flash.
  if (!isReady) {
    return <AuthLoadingScreen />;
  }

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
