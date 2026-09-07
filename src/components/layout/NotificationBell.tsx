import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/db/client";
import { useAuth } from "@/hooks/useAuth";

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch initial notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching notifications:", error);
        return [];
      }
      return data as Notification[];
    },
    enabled: !!user?.id,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.id) return;

    const channelId = `notifications-bell-${user.id}-${Math.random().toString(36).substring(7)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) => {
            return [payload.new as Notification, ...old].slice(0, 20);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) => {
            const newNotif = payload.new as Notification;
            return old.map((n) => (n.id === newNotif.id ? newNotif : n));
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;

    // Optimistic update
    queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) => {
      return old.map((n) => (n.id === id ? { ...n, is_read: true } : n));
    });

    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;

    // Optimistic update
    queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) => {
      return old.map((n) => ({ ...n, is_read: true }));
    });

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-2.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground ring-2 ring-background">
              {/* Optional: unreadCount */}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 max-h-[80vh] overflow-hidden flex flex-col rounded-xl border-border/50 shadow-xl bg-background/95 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <DropdownMenuLabel className="p-0 font-display font-semibold text-base">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-0 text-xs font-medium text-primary hover:text-primary/80 hover:bg-transparent"
            >
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="bg-border/50" />

        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="size-8 mx-auto mb-3 opacity-20" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex flex-col gap-1 rounded-lg p-3 text-sm transition-colors cursor-pointer hover:bg-surface ${
                  !n.is_read ? "bg-primary/5 border border-primary/10" : ""
                }`}
                onClick={() => {
                  if (!n.is_read) markAsRead(n.id);
                  setIsOpen(false);
                }}
              >
                <div className="flex justify-between items-start gap-2">
                  <span
                    className={`font-semibold ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {n.title}
                  </span>
                  <span className="text-[10px] whitespace-nowrap text-muted-foreground/80 mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p
                  className={`text-xs ${!n.is_read ? "text-foreground/90" : "text-muted-foreground"}`}
                >
                  {n.message}
                </p>
                {n.metadata?.link && (
                  <Link
                    to={n.metadata.link}
                    className="text-[11px] font-medium text-primary hover:underline mt-1 w-fit"
                  >
                    View details
                  </Link>
                )}
              </div>
            ))
          )}
        </div>

        <DropdownMenuSeparator className="bg-border/50" />
        <div className="p-2">
          <Button asChild variant="ghost" className="w-full text-xs font-semibold text-primary">
            <Link to="/notifications" onClick={() => setIsOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
