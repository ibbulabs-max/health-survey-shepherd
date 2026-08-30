import { tables } from "@/config/database";
import type { RiskLevel } from "@/config/risk";
import { supabase } from "@/db/client";
import type { FollowUp, House, HouseMember, MemberAssessment } from "@/db/types";
import {
  buildHouseView,
  buildMemberView,
  followUpStatus,
  toDateKey,
  type HouseView,
  type MemberView,
} from "@/lib/domain";

/**
 * One dataset loader used by Home, Map, Analytics, Reports, Follow-ups and
 * Data Quality. Cached by TanStack Query so pages never refetch separately.
 */
export interface Dataset {
  houses: HouseView[];
  members: MemberView[];
  followUps: FollowUp[];
  byHouseUuid: Map<string, HouseView>;
  byMemberId: Map<string, MemberView>;
}

const PAGE = 1000;

async function fetchAll<T>(table: string, select: string, order = "created_at"): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return rows;
}

export async function loadDataset(): Promise<Dataset> {
  const [houses, members, assessments, followUps] = await Promise.all([
    fetchAll<House>(tables.houses, "*"),
    fetchAll<HouseMember>(tables.houseMembers, "*"),
    fetchAll<MemberAssessment>(tables.memberAssessments, "*"),
    fetchAll<FollowUp>(tables.followUps, "*"),
  ]);

  // Load health threshold settings from DB so eligibility and risk are consistent.
  let minEligibleAge: number | undefined = undefined;
  let thresholds: Parameters<typeof buildMemberView>[4] = undefined;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    let targetSupervisorId: string | null = null;

    if (userId) {
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      const role = r?.role;

      if (role === "supervisor") {
        targetSupervisorId = userId;
      } else if (role === "survey_user") {
        const { data: teamData } = await supabase
          .from("team_memberships")
          .select("supervisor_id")
          .eq("csw_id", userId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        targetSupervisorId = teamData?.supervisor_id ?? null;
      }
    }

    let query = supabase.from("health_threshold_settings").select("*");
    if (targetSupervisorId) {
      query = query.or(`supervisor_id.is.null,supervisor_id.eq.${targetSupervisorId}`);
    } else {
      query = query.is("supervisor_id", null);
    }

    // Order nulls first so supervisor override is the last row applied
    const { data, error } = await query.order("supervisor_id", {
      ascending: true,
      nullsFirst: true,
    });

    let settings: any = {};
    if (data && data.length > 0) {
      for (const row of data) {
        settings = { ...settings, ...row };
      }
    }

    if (Object.keys(settings).length > 0) {
      if (typeof settings.minimum_eligible_age === "number") {
        minEligibleAge = settings.minimum_eligible_age;
      }
      thresholds = {
        bp: {
          high: { systolic: settings.systolic_high_min, diastolic: settings.diastolic_high_min },
          moderate: {
            systolic: settings.systolic_moderate_min,
            diastolic: settings.diastolic_moderate_min,
          },
        },
        sugar: {
          high: settings.sugar_high_min,
          moderate: settings.sugar_moderate_min,
        },
      };
    }
  } catch (e) {
    console.warn("Failed to load health threshold settings, falling back to defaults:", e);
  }

  const latestAssessment = new Map<string, MemberAssessment>();
  assessments.forEach((a) => {
    if (!a.member_uuid) return;
    const current = latestAssessment.get(a.member_uuid);
    const stamp = a.assessed_at ?? a.created_at ?? "";
    const currentStamp = current?.assessed_at ?? current?.created_at ?? "";
    if (!current || stamp >= currentStamp) latestAssessment.set(a.member_uuid, a);
  });

  const houseById = new Map(houses.map((h) => [h.id, h]));
  const memberViews = members.map((m) =>
    buildMemberView(
      m,
      latestAssessment.get(m.id) ?? null,
      houseById.get(m.house_uuid ?? ""),
      minEligibleAge,
      thresholds,
    ),
  );

  const membersByHouse = new Map<string, MemberView[]>();
  memberViews.forEach((m) => {
    const key = m.houseUuid ?? "";
    membersByHouse.set(key, [...(membersByHouse.get(key) ?? []), m]);
  });

  const pendingByHouse = new Map<string, number>();
  followUps.forEach((f) => {
    const status = followUpStatus(f.status, f.due_date);
    if (status === "due" || status === "overdue") {
      const key = f.house_uuid ?? "";
      pendingByHouse.set(key, (pendingByHouse.get(key) ?? 0) + 1);
    }
  });

  const houseViews = houses.map((h) =>
    buildHouseView(h, membersByHouse.get(h.id) ?? [], pendingByHouse.get(h.id) ?? 0),
  );

  return {
    houses: houseViews,
    members: memberViews,
    followUps,
    byHouseUuid: new Map(houseViews.map((h) => [h.house.id, h])),
    byMemberId: new Map(memberViews.map((m) => [m.id, m])),
  };
}

export const datasetQueryKey = ["dataset"] as const;

/** Every module invalidates through this single key after any mutation. */
export interface DashboardStats {
  houses: number;
  mappedHouses: number;
  members: number;
  eligible: number;
  screened: number;
  pendingScreening: number;
  risk: Record<RiskLevel, number>;
  todayFollowUps: number;
  completedToday: number;
  pendingToday: number;
  overdue: number;
  dataQualityAlerts: number;
}

export function computeStats(dataset: Dataset): DashboardStats {
  const today = toDateKey(new Date());
  const risk: Record<RiskLevel, number> = { low: 0, moderate: 0, high: 0 };
  dataset.members.forEach((m) => {
    risk[m.risk] += 1;
  });

  const dueToday = dataset.followUps.filter((f) => (f.due_date ?? "") === today);
  return {
    houses: dataset.houses.length,
    mappedHouses: dataset.houses.filter((h) => h.hasLocation).length,
    members: dataset.members.length,
    eligible: dataset.members.filter((m) => m.eligible).length,
    screened: dataset.members.filter((m) => m.screenedAt).length,
    pendingScreening: dataset.members.filter((m) => m.eligible && !m.screenedAt).length,
    risk,
    todayFollowUps: dueToday.length,
    completedToday: dueToday.filter((f) => followUpStatus(f.status, f.due_date) === "completed")
      .length,
    pendingToday: dueToday.filter((f) => {
      const s = followUpStatus(f.status, f.due_date);
      return s !== "completed" && s !== "missed";
    }).length,
    overdue: dataset.followUps.filter((f) => followUpStatus(f.status, f.due_date) === "overdue")
      .length,
    dataQualityAlerts: dataset.members.reduce((n, m) => n + m.dataIssues.length, 0),
  };
}
