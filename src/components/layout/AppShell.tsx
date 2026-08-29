import React, { useState } from "react";
import { Link, useRouterState, CatchBoundary, useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Plus,
  MoreHorizontal,
  Home,
  Users,
  Map,
  CalendarCheck,
  BarChart3,
  ShieldCheck,
  Activity,
} from "lucide-react";

import { ErrorState } from "@/components/common/EmptyState";
import { navItems } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { appConfig } from "@/config/app";
import { roleLabels } from "@/config/roles";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    useSettings.getState().loadSettings();
  }, []);
  
  const { user, role, can, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  const visible = navItems.filter((item) => {
    if (item.permission && !can(item.permission)) return false;
    if (item.roles && role && !item.roles.includes(role)) return false;
    return true;
  });

  const initials = (user?.profile?.full_name ?? user?.userId ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tabs = [{ to: "/dashboard" }];
  if (role === "survey_user") {
    tabs.push({ to: "/map" }, { to: "/followups" }, { to: "/assessments" });
  } else if (role === "supervisor") {
    tabs.push({ to: "/team" }, { to: "/map" }, { to: "/analytics" });
  } else {
    tabs.push({ to: "/users" }, { to: "/map" }, { to: "/analytics" });
  }
  const tabPaths = tabs.map(t => t.to);
  const moreItems = visible.filter((item) => !tabPaths.includes(item.to) || (item.to === "/assessments" && role === "survey_user"));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1920px]">
        {/* Desktop Navigation Tree */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
          <div className="px-2">
            <p className="font-display text-lg font-bold text-foreground">{appConfig.name}</p>
            <p className="text-xs text-muted-foreground">{appConfig.builtBy}</p>
          </div>

          {role === "survey_user" && (
            <div className="mt-6 px-1">
              <Button
                asChild
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
              >
                <Link to="/survey/new">
                  <Plus className="size-4 stroke-[2.5]" />
                  <span>New Survey</span>
                </Link>
              </Button>
            </div>
          )}

          <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {visible.map((item) => {
              const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors outline-none"
                >
                  {active && (
                    <motion.div
                      layoutId="desktop-active-nav"
                      className="absolute inset-0 rounded-xl bg-primary/10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <item.icon
                    className={cn("size-4.5 z-10 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
                    strokeWidth={active ? 2.3 : 1.9}
                  />
                  <span className={cn("z-10 transition-colors", active ? "text-primary font-semibold" : "text-muted-foreground group-hover:text-foreground")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="rounded-2xl border border-border bg-surface-muted p-3 mt-4">
            <p className="truncate text-sm font-semibold text-foreground">
              {user?.profile?.full_name ?? user?.userId}
            </p>
            <p className="text-xs text-muted-foreground">{role ? roleLabels[role] : "No role"}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start px-2 text-muted-foreground hover:text-destructive text-xs"
              onClick={() => void signOut()}
            >
              <LogOut className="size-3.5 mr-1.5" /> Sign out
            </Button>
          </div>
        </aside>

        {/* Main Content Area (Shared) */}
        <div className="flex min-h-screen w-full min-w-0 flex-col">
          {/* Mobile Top Header */}
          <header className="sticky top-0 z-30 border-b border-border ios-glass-panel lg:hidden">
            <div className="flex items-center justify-between px-4 py-3 safe-top">
              <div>
                <p className="font-display text-base font-bold text-foreground">{appConfig.shortName}</p>
                <p className="text-[11px] text-muted-foreground">{role ? roleLabels[role] : "No role"}</p>
              </div>
              <div className="flex items-center gap-2">
                {role === "survey_user" && (
                  <Link
                    to="/survey/new"
                    className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs active:scale-95 transition-transform"
                  >
                    <Plus className="size-4.5 stroke-[2.5]" />
                  </Link>
                )}
                <Link
                  to="/settings"
                  className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary"
                >
                  {initials}
                </Link>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-8">
            <CatchBoundary
              getResetKey={() => pathname}
              errorComponent={({ error, reset }) => (
                <div className="pt-12">
                  <ErrorState
                    message={error.message || "An unexpected error occurred loading this section."}
                    onRetry={() => {
                      reset();
                      router.invalidate();
                    }}
                  />
                </div>
              )}
            >
              {children}
            </CatchBoundary>
          </main>

          {/* Mobile Bottom Navigation Tree (Liquid Glass Floating) */}
          {!pathname.startsWith("/survey/new") && (
            <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden px-4 safe-bottom pb-4 pointer-events-none">
              <nav className="mx-auto flex w-full max-w-sm items-center justify-around rounded-3xl p-2 ios-glass shadow-float pointer-events-auto">
                {(() => {
                  const mobileTabs = [{ to: "/dashboard", label: "Home", icon: Home }];
                  if (role === "survey_user") {
                    mobileTabs.push({ to: "/map", label: "Map", icon: Map });
                    mobileTabs.push({ to: "/followups", label: "Tasks", icon: CalendarCheck });
                    mobileTabs.push({ to: "/assessments", label: "Health", icon: Activity }); 
                  } else if (role === "supervisor") {
                    mobileTabs.push({ to: "/team", label: "Team", icon: Users });
                    mobileTabs.push({ to: "/map", label: "Map", icon: Map });
                    mobileTabs.push({ to: "/analytics", label: "Data", icon: BarChart3 });
                  } else {
                    mobileTabs.push({ to: "/users", label: "Users", icon: ShieldCheck });
                    mobileTabs.push({ to: "/map", label: "Map", icon: Map });
                    mobileTabs.push({ to: "/analytics", label: "Data", icon: BarChart3 });
                  }

                  return (
                    <>
                      {mobileTabs.map((tab, idx) => {
                        const active = pathname.startsWith(tab.to) && (tab.to !== "/houses" || pathname !== "/survey/new");
                        return (
                          <Link
                            key={tab.to}
                            to={tab.to}
                            className="relative flex flex-col items-center justify-center w-14 h-12 outline-none tap-highlight-transparent"
                          >
                            {active && (
                              <motion.div
                                layoutId="mobile-active-nav"
                                className="absolute inset-0 rounded-2xl bg-primary/10"
                                initial={false}
                                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                              />
                            )}
                            <motion.div
                              whileTap={{ scale: 0.85 }}
                              className="relative z-10 flex flex-col items-center gap-0.5"
                            >
                              <tab.icon
                                className={cn("size-5 transition-colors duration-300", active ? "text-primary" : "text-muted-foreground")}
                                strokeWidth={active ? 2.5 : 1.8}
                              />
                              <span className={cn("text-[9px] font-semibold transition-colors duration-300", active ? "text-primary" : "text-muted-foreground")}>
                                {tab.label}
                              </span>
                            </motion.div>
                          </Link>
                        );
                      })}
                    </>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => setMoreDrawerOpen(true)}
                  className="relative flex flex-col items-center justify-center w-14 h-12 outline-none tap-highlight-transparent"
                >
                  <motion.div whileTap={{ scale: 0.85 }} className="relative z-10 flex flex-col items-center gap-0.5">
                    <MoreHorizontal
                      className={cn("size-5 transition-colors duration-300", moreDrawerOpen ? "text-primary" : "text-muted-foreground")}
                      strokeWidth={moreDrawerOpen ? 2.5 : 1.8}
                    />
                    <span className={cn("text-[9px] font-semibold transition-colors duration-300", moreDrawerOpen ? "text-primary" : "text-muted-foreground")}>
                      More
                    </span>
                  </motion.div>
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>

      <Drawer open={moreDrawerOpen} onOpenChange={setMoreDrawerOpen}>
        <DrawerContent className="max-w-md mx-auto rounded-t-[32px] border-border ios-glass-panel">
          <div className="px-6 pb-10 pt-3 space-y-5">
            <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-2" />
            <DrawerHeader className="text-left px-0 pb-2">
              <DrawerTitle className="font-display text-xl font-bold">More Options</DrawerTitle>
              <DrawerDescription className="text-sm">
                Access additional tools and settings.
              </DrawerDescription>
            </DrawerHeader>

            <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
              {moreItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreDrawerOpen(false)}
                  className={cn(
                    "p-4 rounded-[20px] border flex flex-col gap-3 transition-all outline-none",
                    pathname.startsWith(item.to)
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-surface/60 text-foreground border-border/50 active:bg-surface-muted"
                  )}
                >
                  <div className={cn("size-10 rounded-2xl flex items-center justify-center shrink-0", pathname.startsWith(item.to) ? "bg-primary text-primary-foreground shadow-md" : "bg-surface-muted text-muted-foreground")}>
                    <item.icon className="size-5" strokeWidth={2} />
                  </div>
                  <span className="text-sm font-semibold truncate">{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="pt-4 border-t border-border/40">
              <Button
                variant="outline"
                className="w-full h-12 rounded-[20px] text-sm font-bold text-destructive active:bg-destructive/10 border-destructive/20 bg-destructive/5 ios-glass-button"
                onClick={() => {
                  setMoreDrawerOpen(false);
                  void signOut();
                }}
              >
                <LogOut className="size-4 mr-2" /> Sign out
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
