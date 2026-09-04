import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, MessageSquare, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { supabase } from "@/db/client";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { sendNotificationFn } from "@/services/notificationService";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const sendNotificationSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  targetType: z.enum(["specific", "role", "all", "team"]),
  targetRole: z.string().optional(),
});

function NotificationsPage() {
  const { user, role, can } = useAuth();
  const queryClient = useQueryClient();
  const { isSupported, permission, subscribe } = usePushNotifications();
  const [sendSheetOpen, setSendSheetOpen] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`public:notifications_page:user_id=eq.${user.id}`)
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
        }
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
            return old.map(n => n.id === newNotif.id ? newNotif : n);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) =>
      old.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    queryClient.setQueryData(["notifications", user.id], (old: Notification[] = []) =>
      old.map(n => ({ ...n, is_read: true }))
    );
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  };

  const form = useForm<z.infer<typeof sendNotificationSchema>>({
    resolver: zodResolver(sendNotificationSchema),
    defaultValues: {
      title: "",
      message: "",
      targetType: role === "supervisor" ? "team" : "all",
      targetRole: "",
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (values: z.infer<typeof sendNotificationSchema>) => {
      if (!user?.id) throw new Error("Not logged in");
      return await sendNotificationFn({
        data: {
          senderId: user.id,
          title: values.title,
          message: values.message,
          targetType: values.targetType,
          targetRole: values.targetRole,
        }
      });
    },
    onSuccess: (data) => {
      toast.success("Sent", { description: `Sent to ${data.sent} recipient(s).` });
      setSendSheetOpen(false);
      form.reset();
    },
    onError: (err) => {
      toast.error("Error", { description: err.message });
    },
  });

  const canSend = role === "admin" || role === "super_admin" || role === "supervisor";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Notifications & Chat
          </h1>
          <p className="text-sm text-muted-foreground">Stay updated with the latest alerts</p>
        </div>

        <div className="flex items-center gap-3">
          {isSupported && permission !== "granted" && (
            <Button variant="outline" size="sm" onClick={() => subscribe()}>
              <Bell className="size-4 mr-2" /> Enable Push
            </Button>
          )}

          {canSend && (
            <Sheet open={sendSheetOpen} onOpenChange={setSendSheetOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Send className="size-4 mr-2" /> Send Alert
                </Button>
              </SheetTrigger>
              <SheetContent className="sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Send Notification</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((v) => sendMutation.mutate(v))} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input placeholder="E.g., System Maintenance" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Details..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {(role === "admin" || role === "super_admin") && (
                        <>
                          <FormField
                            control={form.control}
                            name="targetType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Recipient Scope</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select target" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="all">Everyone</SelectItem>
                                    <SelectItem value="role">Specific Role</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {form.watch("targetType") === "role" && (
                            <FormField
                              control={form.control}
                              name="targetRole"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Role</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="survey_user">CHWs</SelectItem>
                                      <SelectItem value="supervisor">Supervisors</SelectItem>
                                      <SelectItem value="admin">Admins</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                        </>
                      )}

                      {role === "supervisor" && (
                        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                          <AlertCircle className="size-4 inline mr-1" />
                          This message will be sent to all CHWs currently assigned to your team.
                        </div>
                      )}

                      <Button type="submit" className="w-full" disabled={sendMutation.isPending}>
                        {sendMutation.isPending ? "Sending..." : "Send"}
                      </Button>
                    </form>
                  </Form>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="notifications">
            <Bell className="size-4 mr-2" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="size-4 mr-2" /> Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Recent</h2>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllAsRead}>
              <CheckCircle2 className="size-3.5 mr-1" /> Mark all read
            </Button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Bell className="mx-auto mb-3 size-8 text-muted-foreground/30" />
                <h3 className="text-sm font-semibold text-foreground">All caught up</h3>
                <p className="text-xs text-muted-foreground">No new notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.is_read) markAsRead(n.id); }}
                  className={`group relative flex flex-col gap-1.5 rounded-2xl border p-4 transition-all hover:bg-surface sm:flex-row sm:items-start sm:gap-4 ${
                    !n.is_read
                      ? "border-primary/20 bg-primary/5 cursor-pointer shadow-sm"
                      : "border-border/50 bg-background"
                  }`}
                >
                  <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${!n.is_read ? 'bg-primary/20 text-primary' : 'bg-surface-muted text-muted-foreground'}`}>
                    <Bell className="size-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-semibold ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <p className={`text-sm ${!n.is_read ? "text-foreground/90" : "text-muted-foreground"}`}>
                      {n.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="chat" className="mt-6">
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground/30" />
            <h3 className="text-sm font-semibold text-foreground">Chat Coming Soon</h3>
            <p className="text-xs text-muted-foreground">Secure messaging infrastructure is being prepared.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
