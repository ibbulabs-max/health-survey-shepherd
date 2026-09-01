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
import { useSettings } from "@/hooks/useSettings";

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
  try {
    let houses: House[],
      members: HouseMember[],
      assessments: MemberAssessment[],
      followUps: FollowUp[];
    try {
      [houses, members, assessments, followUps] = await Promise.all([
        fetchAll<House>(tables.houses, "*"),
        fetchAll<HouseMember>(tables.houseMembers, "*"),
        fetchAll<MemberAssessment>(tables.memberAssessments, "*"),
        fetchAll<FollowUp>(tables.followUps, "*"),
      ]);
    } catch (err) {
      console.error("loadDataset fetchAll failed!", err);
      throw err;
    }

    // Load health threshold settings from useSettings (Single Source of Truth)
    let minEligibleAge: number | undefined = undefined;
    let thresholds: Parameters<typeof buildMemberView>[4] = undefined;

    try {
      const s = useSettings.getState();
      if (typeof s.minEligibleAge === "number") {
        minEligibleAge = s.minEligibleAge;
      }

      if (s.thresholds) {
        thresholds = {
          bp: {
            high: {
              systolic: s.thresholds.systolic_high_min,
              diastolic: s.thresholds.diastolic_high_min,
            },
            moderate: {
              systolic: s.thresholds.systolic_moderate_min,
              diastolic: s.thresholds.diastolic_moderate_min,
            },
          },
          sugar: {
            high: s.thresholds.sugar_high_min,
            moderate: s.thresholds.sugar_moderate_min,
          },
        };
      }
    } catch (e) {
      console.warn(
        "Failed to load health threshold settings from store, falling back to defaults:",
        e,
      );
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
  } catch (err) {
    console.error("loadDataset CRITICAL ERROR:", err);
    throw err;
  }
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
  const risk: Record<RiskLevel, number> = { normal: 0, moderate: 0, high: 0 };
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
