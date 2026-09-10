import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  mobileLogin,
  saveSession,
  type MobileUser,
} from "./api";

type AuthState = {
  ready: boolean;
  user: MobileUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, stored] = await Promise.all([
        getAccessToken(),
        getStoredUser(),
      ]);
      if (!cancelled && token && stored) {
        setUser(stored);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await mobileLogin(email.trim(), password);
    await saveSession(result.accessToken, result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ ready, user, login, logout }),
    [ready, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
