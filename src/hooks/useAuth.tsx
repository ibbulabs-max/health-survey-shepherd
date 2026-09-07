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
  isMasterAdmin: boolean;
  isTestMode: boolean;
  actualRole: AppRole | null;
  selectedOrgId: string | null;
  setSelectedOrgId: (orgId: string | null) => void;
  can: (permission: Permission) => boolean;
  signIn: (userId: string, pin: string) => Promise<SessionUser | null>;
  signOut: () => Promise<void>;
  changePin: (pin: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("MASTER_ADMIN_SELECTED_ORG") || null;
    }
    return null;
  });
  const queryClient = useQueryClient();

  const handleSetSelectedOrgId = useCallback(
    (orgId: string | null) => {
      setSelectedOrgId(orgId);
      if (typeof window !== "undefined") {
        if (orgId) {
          localStorage.setItem("MASTER_ADMIN_SELECTED_ORG", orgId);
        } else {
          localStorage.removeItem("MASTER_ADMIN_SELECTED_ORG");
        }
      }
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

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
      isMasterAdmin: (!user?.testSession && user?.role === "master_admin"),
      isTestMode: Boolean(user?.testSession),
      actualRole: (user?.testSession ? "master_admin" : (user?.role ?? null)) as AppRole | null,
      selectedOrgId,
      setSelectedOrgId: handleSetSelectedOrgId,
      can: (permission) => roleHasPermission(user?.role ?? null, permission),
      signIn: async (userId, pin) => {
        await signInWithPin(userId, pin);
        const nextUser = await loadSessionUser();
        setUser(nextUser);
        setLoading(false);
        return nextUser;
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
    [user, loading, selectedOrgId, handleSetSelectedOrgId, refresh, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
