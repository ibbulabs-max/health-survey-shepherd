import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bell,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Video,
  Plus,
  Clock,
  Users,
  ExternalLink,
  Radio,
} from "lucide-react";

import { supabase } from "@/db/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { sendNotificationFn } from "@/services/notificationService";
import { communicationService, ChatMessage, Meeting } from "@/services/communicationService";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata: any;
  created_at: string;
  type?: string;
};

function NotificationsPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { isSupported, permission, subscribe } = usePushNotifications();

  const [sendSheetOpen, setSendSheetOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Broadcast Notification Form State
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifTargetType, setNotifTargetType] = useState<"all" | "role" | "team">(
    role === "supervisor" ? "team" : "all",
  );
  const [notifTargetRole, setNotifTargetRole] = useState("survey_user");

  // Schedule Meeting Form State
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split("T")[0] || "2026-09-08",
  );
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingLocationLink, setMeetingLocationLink] = useState("https://meet.google.com/");

  // --- 1. Notifications Query & Realtime ---
  const { data: notifications = [], isLoading: isNotifLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) return [];
      return (data || []) as Notification[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channelId = `notifications-page-${user.id}-${Math.random().toString(36).substring(7)}`;
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
            return [payload.new as Notification, ...old].slice(0, 100);
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
    queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) =>
      old.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) console.error("Failed to mark as read:", error);
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) =>
      old.map((n) => ({ ...n, is_read: true })),
    );
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    toast.success("All marked as read");
  };

  // --- 2. Team Chat Query & Realtime ---
  const { data: messages = [], isLoading: isChatLoading } = useQuery({
    queryKey: ["team_chat_messages"],
    queryFn: () => communicationService.getMessages("general"),
    refetchInterval: 10000,
  });

  useEffect(() => {
    const chatChannel = supabase
      .channel("communications-chat")
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        queryClient.setQueryData(["team_chat_messages"], (old: ChatMessage[] = []) => {
          if (old.some((m) => m.id === payload.id)) return old;
          return [...old, payload];
        });
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [queryClient]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatMessage.trim() || !user?.id) return;

    const content = chatMessage.trim();
    setChatMessage("");

    const senderName =
      user?.profile?.full_name || user?.email?.split("@")[0] || user?.userId || "Field Operative";
    const newMsg = await communicationService.sendMessage({
      senderId: user.id,
      senderName,
      senderRole: role || "survey_user",
      content,
    });

    queryClient.setQueryData(["team_chat_messages"], (old: ChatMessage[] = []) => [...old, newMsg]);

    supabase.channel("communications-chat").send({
      type: "broadcast",
      event: "new_message",
      payload: newMsg,
    });

    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // --- 3. Meetings Query & Mutations ---
  const { data: meetings = [], isLoading: isMeetingsLoading } = useQuery({
    queryKey: ["team_meetings"],
    queryFn: () => communicationService.getMeetings(),
  });

  const createMeetingMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!meetingTitle.trim()) throw new Error("Title is required");
      return await communicationService.createMeeting({
        userId: user.id,
        title: meetingTitle,
        description: meetingDescription || undefined,
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        location_link: meetingLocationLink || undefined,
      });
    },
    onSuccess: (newM) => {
      queryClient.setQueryData(["team_meetings"], (old: Meeting[] = []) => [...old, newM]);
      toast.success("Meeting Scheduled", { description: "Team members have been notified." });
      setMeetingDialogOpen(false);
      setMeetingTitle("");
      setMeetingDescription("");
    },
    onError: (err: any) => {
      toast.error("Failed to schedule", { description: err.message });
    },
  });

  // --- 4. Broadcast Notification Mutation ---
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not logged in");
      if (!notifTitle.trim()) throw new Error("Title is required");
      if (!notifMessage.trim()) throw new Error("Message is required");

      return await sendNotificationFn({
        data: {
          senderId: user.id,
          title: notifTitle,
          message: notifMessage,
          targetType: notifTargetType,
          targetRole: notifTargetType === "role" ? notifTargetRole : undefined,
        },
      });
    },
    onSuccess: (data) => {
      toast.success("Notification Broadcasted", {
        description: `Sent to ${data.sent} recipient(s).`,
      });
      setSendSheetOpen(false);
      setNotifTitle("");
      setNotifMessage("");
    },
    onError: (err: any) => {
      toast.error("Error", { description: err.message });
    },
  });

  const canBroadcast =
    role === "admin" || role === "super_admin" || role === "master_admin" || role === "supervisor";

  const getRoleBadge = (msgRole?: string) => {
    switch (msgRole) {
      case "master_admin":
        return (
          <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 text-[10px] px-1.5 py-0">
            Master Admin
          </Badge>
        );
      case "super_admin":
      case "admin":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
            Admin
          </Badge>
        );
      case "supervisor":
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] px-1.5 py-0">
            Supervisor
          </Badge>
        );
      case "system":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0">
            System
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            CHW
          </Badge>
        );
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Bell className="size-6 text-primary" />
            Communications & Operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time field notifications, team coordination chat, and video syncs
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isSupported && permission !== "granted" && (
            <Button variant="outline" size="sm" onClick={() => subscribe()}>
              <Radio className="size-4 mr-2 text-primary" /> Enable Push
            </Button>
          )}

          {canBroadcast && (
            <Sheet open={sendSheetOpen} onOpenChange={setSendSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="default" className="shadow-sm">
                  <Send className="size-4 mr-2" /> Broadcast Alert
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Send className="size-5 text-primary" /> Broadcast Notification
                  </SheetTitle>
                </SheetHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMutation.mutate();
                  }}
                  className="space-y-4 mt-6"
                >
                  <div className="space-y-2">
                    <Label htmlFor="notif-title">Title</Label>
                    <Input
                      id="notif-title"
                      placeholder="E.g., High-Risk Referral Alert"
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notif-body">Message Content</Label>
                    <Textarea
                      id="notif-body"
                      placeholder="Details for the field operatives..."
                      rows={4}
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      required
                    />
                  </div>

                  {(role === "admin" || role === "super_admin" || role === "master_admin") && (
                    <>
                      <div className="space-y-2">
                        <Label>Recipient Scope</Label>
                        <Select
                          value={notifTargetType}
                          onValueChange={(v: "all" | "role" | "team") => setNotifTargetType(v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select target" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Everyone in Organization</SelectItem>
                            <SelectItem value="role">Specific Role</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {notifTargetType === "role" && (
                        <div className="space-y-2">
                          <Label>Role Target</Label>
                          <Select
                            value={notifTargetRole}
                            onValueChange={(v) => setNotifTargetRole(v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="survey_user">
                                Community Health Workers (CHWs)
                              </SelectItem>
                              <SelectItem value="supervisor">Supervisors</SelectItem>
                              <SelectItem value="admin">Administrators</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}

                  {role === "supervisor" && (
                    <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300">
                      <AlertCircle className="size-4 inline mr-1.5" />
                      This alert will be delivered to all CHWs assigned to your active teams.
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
                    {sendMutation.isPending ? "Broadcasting..." : "Send Notification"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      {/* Main Tabs Hub */}
      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-10 p-1 bg-surface-muted/60 backdrop-blur rounded-xl border border-border/50">
          <TabsTrigger value="notifications" className="text-xs sm:text-sm">
            <Bell className="size-4 mr-1.5" />
            Alerts
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-semibold text-primary-foreground">
                {notifications.filter((n) => !n.is_read).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-xs sm:text-sm">
            <MessageSquare className="size-4 mr-1.5" /> Team Chat
          </TabsTrigger>
          <TabsTrigger value="meetings" className="text-xs sm:text-sm">
            <Calendar className="size-4 mr-1.5" /> Meetings
          </TabsTrigger>
        </TabsList>

        {/* --- 1. NOTIFICATIONS TAB --- */}
        <TabsContent value="notifications" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Recent Operational Alerts
            </h2>
            {notifications.some((n) => !n.is_read) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllAsRead}>
                <CheckCircle2 className="size-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {isNotifLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40 backdrop-blur">
                <Bell className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                <h3 className="text-sm font-semibold text-foreground">All caught up</h3>
                <p className="text-xs text-muted-foreground">No new notifications at this time.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markAsRead(n.id);
                  }}
                  className={`group relative flex flex-col gap-2 rounded-2xl border p-4 transition-all hover:bg-surface sm:flex-row sm:items-start sm:gap-4 ${
                    !n.is_read
                      ? "border-primary/30 bg-primary/5 cursor-pointer shadow-sm"
                      : "border-border/50 bg-card/60 backdrop-blur"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                      !n.is_read
                        ? "bg-primary/20 text-primary"
                        : "bg-surface-muted text-muted-foreground"
                    }`}
                  >
                    <Bell className="size-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm font-semibold ${
                          !n.is_read ? "text-foreground font-bold" : "text-muted-foreground"
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p
                      className={`text-sm ${!n.is_read ? "text-foreground/90" : "text-muted-foreground"}`}
                    >
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* --- 2. TEAM CHAT TAB --- */}
        <TabsContent value="chat" className="mt-6">
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur flex flex-col h-[560px] overflow-hidden shadow-sm">
            {/* Chat Room Header */}
            <div className="px-4 py-3 border-b border-border/60 bg-surface-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    Field Operations & Team Sync
                    <span className="inline-block size-2 rounded-full bg-emerald-500" />
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    General channel for field updates & queries
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                Live Broadcast
              </Badge>
            </div>

            {/* Chat Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-background/50">
              {isChatLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-xs">
                  No messages yet. Send a message below to start the conversation!
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  const isSystem = msg.sender_id === "system" || msg.sender_role === "system";

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="rounded-full bg-muted/80 px-3.5 py-1 text-xs text-muted-foreground border border-border/50 max-w-md text-center">
                          <span className="font-semibold">{msg.sender_name}: </span>
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[70%] ${
                        isOwn ? "ml-auto" : "mr-auto"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className="text-xs font-medium text-foreground">
                          {isOwn ? "You" : msg.sender_name}
                        </span>
                        {getRoleBadge(msg.sender_role)}
                        <span className="text-[10px] text-muted-foreground">
                          {msg.created_at ? format(new Date(msg.created_at), "HH:mm") : ""}
                        </span>
                      </div>

                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                          isOwn
                            ? "bg-primary text-primary-foreground rounded-tr-xs"
                            : "bg-card border border-border text-foreground rounded-tl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Box */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-surface-muted/20 border-t border-border/60 flex items-center gap-2"
            >
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a team message or field update..."
                className="flex-1 bg-background text-sm h-10 rounded-xl"
              />
              <Button
                type="submit"
                size="sm"
                className="h-10 px-4 rounded-xl"
                disabled={!chatMessage.trim()}
              >
                <Send className="size-4 mr-1.5" /> Send
              </Button>
            </form>
          </div>
        </TabsContent>

        {/* --- 3. MEETINGS TAB --- */}
        <TabsContent value="meetings" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Scheduled Video Syncs & Meetings
              </h2>
              <p className="text-xs text-muted-foreground">
                Weekly reviews, training sessions, and supervisor briefings
              </p>
            </div>

            {canBroadcast && (
              <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="shadow-sm">
                    <Plus className="size-4 mr-1.5" /> Schedule Sync
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Calendar className="size-5 text-primary" /> Schedule Team Meeting
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createMeetingMutation.mutate();
                    }}
                    className="space-y-3.5 mt-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="m-title">Topic / Title</Label>
                      <Input
                        id="m-title"
                        placeholder="E.g., High-Risk Referral Case Review"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="m-date">Date</Label>
                        <Input
                          id="m-date"
                          type="date"
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="m-time">Time</Label>
                        <Input
                          id="m-time"
                          type="time"
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="m-link">Google Meet / Zoom URL</Label>
                      <Input
                        id="m-link"
                        placeholder="https://meet.google.com/..."
                        value={meetingLocationLink}
                        onChange={(e) => setMeetingLocationLink(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="m-desc">Agenda (Optional)</Label>
                      <Textarea
                        id="m-desc"
                        placeholder="Agenda items and points to cover..."
                        rows={2}
                        value={meetingDescription}
                        onChange={(e) => setMeetingDescription(e.target.value)}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full mt-2"
                      disabled={createMeetingMutation.isPending}
                    >
                      {createMeetingMutation.isPending ? "Scheduling..." : "Schedule Meeting"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isMeetingsLoading ? (
              <div className="col-span-full p-8 text-center text-muted-foreground text-sm">
                Loading scheduled meetings...
              </div>
            ) : meetings.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center bg-card/40 backdrop-blur">
                <Calendar className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                <h3 className="text-sm font-semibold text-foreground">No upcoming meetings</h3>
                <p className="text-xs text-muted-foreground">
                  Schedule a new sync session for your field teams.
                </p>
              </div>
            ) : (
              meetings.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4 space-y-3 hover:border-primary/30 transition-all shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            m.status === "SCHEDULED"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                              : "bg-muted text-muted-foreground text-[10px]"
                          }
                        >
                          {m.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" /> {m.meeting_time.slice(0, 5)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground">{m.title}</h4>
                    </div>

                    <div className="rounded-xl bg-primary/10 text-primary p-2.5 shrink-0 text-center min-w-[52px]">
                      <div className="text-[10px] font-bold uppercase tracking-wider">
                        {format(new Date(m.meeting_date), "MMM")}
                      </div>
                      <div className="text-lg font-extrabold leading-none">
                        {format(new Date(m.meeting_date), "dd")}
                      </div>
                    </div>
                  </div>

                  {m.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                  )}

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3 text-primary" /> {m.meeting_date}
                    </div>

                    {m.location_link ? (
                      <a
                        href={m.location_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Video className="size-3.5" /> Join Video Sync{" "}
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">In-Person</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
