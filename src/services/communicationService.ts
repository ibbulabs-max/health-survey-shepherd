import { supabase } from "@/db/client";

export interface ChatMessage {
  id: string;
  communication_id?: string | undefined;
  sender_id: string;
  sender_name?: string | undefined;
  sender_role?: string | undefined;
  content: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  created_at: string;
  created_by: string;
  title: string;
  description?: string | undefined;
  meeting_date: string;
  meeting_time: string;
  location_link?: string | undefined;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  organization_id?: string | undefined;
}

const LOCAL_STORAGE_CHAT_KEY = "ncd_team_chat_messages_v1";
const LOCAL_STORAGE_MEETINGS_KEY = "ncd_team_meetings_v1";

const DEFAULT_WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: "welcome-1",
    sender_id: "system",
    sender_name: "Field Operations Bot",
    sender_role: "system",
    content:
      "Welcome to the Team Operations Chat! You can coordinate field surveys, report anomalies, and communicate in real-time.",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export const communicationService = {
  async getMessages(_channelId = "general"): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from("communication_messages")
        .select(
          `
          id,
          communication_id,
          sender_id,
          content,
          created_at
        `,
        )
        .order("created_at", { ascending: true })
        .limit(100);

      if (!error && data && data.length > 0) {
        const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", senderIds);

        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", senderIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));

        return data.map((msg: any) => {
          const profile = profileMap.get(msg.sender_id);
          const role = roleMap.get(msg.sender_id) || "survey_user";
          return {
            id: msg.id,
            communication_id: msg.communication_id ?? undefined,
            sender_id: msg.sender_id,
            sender_name: profile?.full_name || profile?.email?.split("@")[0] || "Team Member",
            sender_role: role,
            content: msg.content,
            created_at: msg.created_at,
          };
        });
      }
    } catch {
      // Fallback
    }

    const stored = localStorage.getItem(LOCAL_STORAGE_CHAT_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Ignore parse error
      }
    }
    return DEFAULT_WELCOME_MESSAGES;
  },

  async sendMessage(params: {
    senderId: string;
    senderName?: string | undefined;
    senderRole?: string | undefined;
    content: string;
    channelId?: string | undefined;
    orgId?: string | undefined;
  }): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender_id: params.senderId,
      sender_name: params.senderName || "Field Operative",
      sender_role: params.senderRole || "survey_user",
      content: params.content.trim(),
      created_at: new Date().toISOString(),
    };

    const stored = localStorage.getItem(LOCAL_STORAGE_CHAT_KEY);
    let messages: ChatMessage[] = [];
    if (stored) {
      try {
        messages = JSON.parse(stored);
      } catch {
        messages = [];
      }
    } else {
      messages = [...DEFAULT_WELCOME_MESSAGES];
    }
    messages.push(newMessage);
    localStorage.setItem(LOCAL_STORAGE_CHAT_KEY, JSON.stringify(messages.slice(-150)));

    try {
      await supabase.from("communication_messages").insert({
        id: newMessage.id,
        sender_id: params.senderId,
        content: newMessage.content,
        created_at: newMessage.created_at,
      });
    } catch {
      // Silently fall back to broadcast channel
    }

    return newMessage;
  },

  async getMeetings(orgId?: string): Promise<Meeting[]> {
    try {
      let query = supabase.from("meetings").select("*").order("meeting_date", { ascending: true });
      if (orgId) {
        query = query.eq("organization_id", orgId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((m: any) => ({
          id: m.id,
          created_at: m.created_at,
          created_by: m.created_by,
          title: m.title,
          description: m.description ?? undefined,
          meeting_date: m.meeting_date,
          meeting_time: m.meeting_time,
          location_link: m.location_link ?? undefined,
          status: m.status,
          organization_id: m.organization_id ?? undefined,
        }));
      }
    } catch {
      // Fallback
    }

    const stored = localStorage.getItem(LOCAL_STORAGE_MEETINGS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // ignore
      }
    }

    const nextDate =
      new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0] || "2026-09-08";
    const sampleMeetings: Meeting[] = [
      {
        id: "sample-meeting-1",
        created_at: new Date().toISOString(),
        created_by: "system",
        title: "Weekly NCD Screening Sync & Risk Review",
        description:
          "Review high-risk hypertension and diabetes referrals, follow-up progress, and field challenges.",
        meeting_date: nextDate,
        meeting_time: "10:00:00",
        location_link: "https://meet.google.com/ncd-screening-sync",
        status: "SCHEDULED",
        organization_id: orgId || "default-org",
      },
    ];
    return sampleMeetings;
  },

  async createMeeting(params: {
    userId: string;
    title: string;
    description?: string | undefined;
    meeting_date: string;
    meeting_time: string;
    location_link?: string | undefined;
    organization_id?: string | undefined;
  }): Promise<Meeting> {
    const newMeeting: Meeting = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      created_by: params.userId,
      title: params.title.trim(),
      description: params.description?.trim() || undefined,
      meeting_date: params.meeting_date,
      meeting_time: params.meeting_time,
      location_link: params.location_link?.trim() || undefined,
      status: "SCHEDULED",
      organization_id: params.organization_id || "00000000-0000-0000-0000-000000000000",
    };

    const stored = localStorage.getItem(LOCAL_STORAGE_MEETINGS_KEY);
    let meetings: Meeting[] = [];
    if (stored) {
      try {
        meetings = JSON.parse(stored);
      } catch {
        meetings = [];
      }
    }
    meetings.push(newMeeting);
    localStorage.setItem(LOCAL_STORAGE_MEETINGS_KEY, JSON.stringify(meetings));

    try {
      await supabase.from("meetings").insert({
        id: newMeeting.id,
        created_by: params.userId,
        title: newMeeting.title,
        description: newMeeting.description || null,
        meeting_date: newMeeting.meeting_date,
        meeting_time: newMeeting.meeting_time,
        location_link: newMeeting.location_link || null,
        status: newMeeting.status,
        organization_id: newMeeting.organization_id,
      });
    } catch {
      // Ignore
    }

    return newMeeting;
  },

  async updateMeetingStatus(
    meetingId: string,
    status: "SCHEDULED" | "CANCELLED" | "COMPLETED",
  ): Promise<void> {
    const stored = localStorage.getItem(LOCAL_STORAGE_MEETINGS_KEY);
    if (stored) {
      try {
        const meetings: Meeting[] = JSON.parse(stored);
        const updated = meetings.map((m) => (m.id === meetingId ? { ...m, status } : m));
        localStorage.setItem(LOCAL_STORAGE_MEETINGS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    try {
      const { error } = await supabase.from("meetings").update({ status }).eq("id", meetingId);
      if (error) throw error;
    } catch {
      // ignore
    }
  },
};
