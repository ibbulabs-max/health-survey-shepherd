import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { autoSignInQA, loadSessionUser, type SessionUser } from "@/services/authService";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (import.meta.env.DEV) {
      await autoSignInQA();
    }
    const sessionUser = await loadSessionUser();
    if (!sessionUser) throw redirect({ to: "/" });
    if (sessionUser.mustChangePin) throw redirect({ to: "/" });
    return { user: sessionUser as SessionUser };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
