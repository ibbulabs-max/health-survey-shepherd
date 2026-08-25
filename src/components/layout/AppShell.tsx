import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { navItems } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { roleLabels } from "@/config/roles";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, role, can, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = navItems.filter((item) => !item.permission || can(item.permission));
  const primary = visible.filter((item) => item.primary).slice(0, 5);
  const initials = (user?.profile?.full_name ?? user?.userId ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
          <div className="px-2">
            <p className="font-display text-lg font-semibold text-foreground">{appConfig.name}</p>
            <p className="text-xs text-muted-foreground">{appConfig.builtBy}</p>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {visible.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4.5" strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="rounded-xl border border-border bg-surface-muted p-3">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.profile?.full_name ?? user?.userId}
            </p>
            <p className="text-xs text-muted-foreground">{role ? roleLabels[role] : "No role"}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start px-2 text-muted-foreground"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen w-full min-w-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-display text-base font-semibold">{appConfig.shortName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {role ? roleLabels[role] : "No role"}
                </p>
              </div>
              <Link
                to="/settings"
                className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
              >
                {initials}
              </Link>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>

          <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 px-1 pt-1.5 backdrop-blur-xl lg:hidden">
            {primary.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[10.5px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
