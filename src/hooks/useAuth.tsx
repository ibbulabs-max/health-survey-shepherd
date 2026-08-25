import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { isAdminLike, roleHasPermission, type AppRole, type Permission } from "@/config/roles";
import { supabase } from "@/db/client";
import {
  changePin as changePinRequest,
  loadSessionUser,
  signInWithPin,
  signOut as signOutRequest,
  type SessionUser,
} from "@/services/authService";

interface AuthContextValue {
  user: SessionUser | null;
  role: AppRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  can: (permission: Permission) => boolean;
  signIn: (userId: string, pin: string) => Promise<void>;
  signOut: () => Promise<void>;
  changePin: (pin: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    const next = await loadSessionUser();
    setUser(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        queryClient.clear();
        return;
      }
      void refresh();
      void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: isAdminLike(user?.role ?? null),
      can: (permission) => roleHasPermission(user?.role ?? null, permission),
      signIn: async (userId, pin) => {
        await signInWithPin(userId, pin);
        await refresh();
      },
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await signOutRequest();
        setUser(null);
      },
      changePin: async (pin) => {
        await changePinRequest(pin);
        await refresh();
      },
      refresh,
    }),
    [user, loading, refresh, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
