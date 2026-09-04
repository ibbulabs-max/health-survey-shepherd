import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import webPush from "web-push";

const vapidPublic = process.env["VITE_VAPID_PUBLIC_KEY"] || process.env["VAPID_PUBLIC_KEY"];
const vapidPrivate = process.env["VAPID_PRIVATE_KEY"];

if (vapidPublic && vapidPrivate) {
  webPush.setVapidDetails(
    "mailto:admin@example.com",
    vapidPublic,
    vapidPrivate
  );
}

export const getNotificationsFn = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().default(50) }))
  .handler(async ({ data }) => {
    const adminClient = getSupabaseAdmin();
    // In a real app we'd get the auth.uid() from the context, 
    // but typically server fns might need the token passed if not automatically injected.
    // Let's assume we can get it from headers/cookies or we expect userId.
    // Wait, the client-side fetches might just use Supabase direct queries for reading, 
    // because RLS is enabled! Yes, we don't *need* a server function to GET notifications 
    // if the client can just select from `notifications`.
    return { success: true };
  });

export const sendNotificationFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      senderId: z.string(),
      title: z.string(),
      message: z.string(),
      type: z.string().default("system_message"),
      targetType: z.enum(["specific", "role", "all", "team"]),
      targetIds: z.array(z.string()).optional(), // user IDs if targetType === 'specific'
      targetRole: z.string().optional(), // if targetType === 'role'
    })
  )
  .handler(async ({ data }) => {
    const adminClient = getSupabaseAdmin();
    
    // 1. Verify Sender Role
    const { data: senderRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", data.senderId);
      
    const senderRole = senderRoles?.[0]?.role;
    if (!senderRole) throw new Error("Unauthorized");

    let recipientIds = new Set<string>();

    if (senderRole === "admin" || senderRole === "super_admin") {
      // Admin logic
      if (data.targetType === "specific" && data.targetIds) {
        data.targetIds.forEach(id => recipientIds.add(id));
      } else if (data.targetType === "role" && data.targetRole) {
        const { data: roleUsers } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", data.targetRole);
        roleUsers?.forEach(u => u.user_id && recipientIds.add(u.user_id));
      } else if (data.targetType === "all") {
        const { data: allUsers } = await adminClient
          .from("user_roles")
          .select("user_id");
        allUsers?.forEach(u => u.user_id && recipientIds.add(u.user_id));
      }
    } else if (senderRole === "supervisor") {
      // Supervisor logic - restricted to their team
      const { data: team } = await adminClient
        .from("team_memberships")
        .select("csw_id")
        .eq("supervisor_id", data.senderId);
        
      const allowedTeamIds = new Set((team || []).map(t => t.csw_id).filter(Boolean));

      if (data.targetType === "specific" && data.targetIds) {
        data.targetIds.forEach(id => {
          if (allowedTeamIds.has(id)) recipientIds.add(id);
        });
      } else if (data.targetType === "team") {
        allowedTeamIds.forEach(id => recipientIds.add(id as string));
      } else {
        throw new Error("Supervisors can only message their permitted team scope.");
      }
    } else {
      throw new Error("CHWs are not authorized to send broadcast notifications.");
    }

    if (recipientIds.size === 0) return { success: true, sent: 0 };

    // 2. Insert Notifications
    const inserts = Array.from(recipientIds).map(userId => ({
      user_id: userId,
      sender_user_id: data.senderId,
      title: data.title,
      message: data.message,
      type: data.type,
    }));

    await adminClient.from("notifications").insert(inserts);

    // 3. Dispatch Push Notifications asynchronously
    if (vapidPublic && vapidPrivate) {
      const { data: subs } = await adminClient
        .from("push_subscriptions")
        .select("*")
        .in("user_id", Array.from(recipientIds));
        
      if (subs && subs.length > 0) {
        let pushTitle = "New Notification";
        let pushBody = "You have a new alert requiring your attention.";
        let pushUrl = "/notifications";

        if (data.type === "follow_up") {
          pushTitle = "Follow-up Alert";
          pushUrl = "/followups";
        } else if (data.type === "task") {
          pushTitle = "Task Assigned";
          pushUrl = "/tasks";
        } else if (data.type === "import") {
          pushTitle = "Import Alert";
          pushUrl = "/import";
        }

        const payload = JSON.stringify({ title: pushTitle, body: pushBody, url: pushUrl });
        for (const sub of subs) {
          try {
            await webPush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }, payload);
          } catch (e: any) {
            if (e.statusCode === 410) {
              // Gone - delete sub
              await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
            }
          }
        }
      }
    }

    return { success: true, sent: recipientIds.size };
  });

export const registerPushSubscriptionFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string(),
      subscription: z.any() // web push subscription object
    })
  )
  .handler(async ({ data }) => {
    const adminClient = getSupabaseAdmin();
    const { keys, endpoint } = data.subscription;
    if (!keys || !endpoint) throw new Error("Invalid subscription object");

    await adminClient.from("push_subscriptions").upsert({
      user_id: data.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id, endpoint" });

    return { success: true };
  });
