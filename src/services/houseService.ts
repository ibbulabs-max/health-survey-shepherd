import { supabase } from "@/db/client";
import { tables } from "@/config/database";
import type { JsonObject } from "@/db/types";
import { logActivity } from "@/services/activityService";
import { loadSessionUser } from "@/services/authService";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getHealthThresholdSettings } from "@/services/settingsService";

export interface CreateHouseMemberInput {
  name: string;
  age: number | null;
  gender: "Male" | "Female" | "Other" | string;
  phone?: string;
  occupation?: string;
}

export interface CreateHouseInput {
  block: string; // e.g. "B1"
  lane: string; // e.g. "L1"
  serialNo: string; // e.g. "001"
  housingType: "Pakka" | "Semi-Pakka" | "Kachcha" | string; // e.g. "Pakka" -> "P"
  houseId: string; // e.g. "B1-L1-001-P"

  // Location & Pin
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  locationName?: string | null;
  locationSource?: string | null;
  pinType?: string; // e.g. "house", "shop", "school"
  customType?: string | null;

  // Availability
  availability: "AVAILABLE" | "NOT_AVAILABLE";
  unavailableReason?: string | null;

  // Household Details
  monthlyIncome?: number | null;
  earningMembers?: number | null;
  totalMembers?: number | null;

  // Members
  members: CreateHouseMemberInput[];
}

export interface UpdateHouseInput extends Partial<CreateHouseInput> {
  id: string;
}

/**
 * Derives housing type code:
 * Pakka -> P
 * Semi-Pakka -> SP
 * Kachcha -> K
 */
export function getHousingTypeCode(housingType: string): string {
  const norm = housingType.toLowerCase().trim();
  if (norm.includes("semi")) return "SP";
  if (norm.startsWith("p")) return "P";
  if (norm.startsWith("k")) return "K";
  return "P";
}

/**
 * Builds canonical House ID: e.g. B1-L1-001-P
 */
export function buildCanonicalHouseId(
  block: string,
  lane: string,
  serialNo: string,
  housingType: string,
): string {
  const b = block.trim().toUpperCase();
  const l = lane.trim().toUpperCase();
  const s = String(serialNo).trim().padStart(3, "0");
  const t = getHousingTypeCode(housingType);
  return `${b}-${l}-${s}-${t}`;
}

/**
 * Calculates next available 3-digit serial number for a given Block + Lane.
 */
export function calculateNextSerial(
  existingHouseIds: string[],
  block: string,
  lane: string,
): string {
  const b = block.trim().toUpperCase();
  const l = lane.trim().toUpperCase();
  const prefix = `${b}-${l}-`;

  const usedSerials = new Set<number>();
  existingHouseIds.forEach((id) => {
    if (!id) return;
    const clean = id.toUpperCase().trim();
    if (clean.startsWith(prefix)) {
      const parts = clean.split("-");
      // Format is B1-L1-001-P (index 2 is serial)
      if (parts.length >= 3) {
        const serialNum = parseInt(parts[2] ?? "", 10);
        if (!isNaN(serialNum) && serialNum > 0) {
          usedSerials.add(serialNum);
        }
      }
    }
  });

  // Find lowest available integer serial starting from 1
  let next = 1;
  while (usedSerials.has(next)) {
    next++;
  }
  return String(next).padStart(3, "0");
}

/**
 * Generates Member ID for 30+ members: e.g. B1-L1-001-P-M01
 */
export function generateMemberId(houseId: string, memberIndex30Plus: number): string {
  const indexPad = String(memberIndex30Plus).padStart(2, "0");
  return `${houseId}-M${indexPad}`;
}

/**
 * Custom blocks and lanes storage
 */
const CUSTOM_BLOCKS_KEY = "management_app_custom_blocks";
const CUSTOM_LANES_KEY = "management_app_custom_lanes";

export function getAvailableBlocks(existingHouseIds: string[] = []): string[] {
  const defaults = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"];
  let customs: string[] = [];
  if (typeof window !== "undefined") {
    try {
      customs = JSON.parse(localStorage.getItem(CUSTOM_BLOCKS_KEY) || "[]");
    } catch {
      customs = [];
    }
  }

  // Also collect from existing house IDs
  const fromData = new Set<string>();
  existingHouseIds.forEach((id) => {
    const parts = (id || "").split("-");
    if (parts[0] && parts[0].startsWith("B")) fromData.add(parts[0].toUpperCase());
  });

  const all = Array.from(new Set([...defaults, ...customs, ...fromData]));
  // Sort naturally: B1, B2, ... B10, B11
  return all.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });
}

export function saveCustomBlock(block: string) {
  if (typeof window === "undefined") return;
  const b = block.trim().toUpperCase();
  if (!b) return;
  const current: string[] = JSON.parse(localStorage.getItem(CUSTOM_BLOCKS_KEY) || "[]");
  if (!current.includes(b)) {
    current.push(b);
    localStorage.setItem(CUSTOM_BLOCKS_KEY, JSON.stringify(current));
  }
}

export function getAvailableLanes(existingHouseIds: string[] = []): string[] {
  const defaults = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"];
  let customs: string[] = [];
  if (typeof window !== "undefined") {
    try {
      customs = JSON.parse(localStorage.getItem(CUSTOM_LANES_KEY) || "[]");
    } catch {
      customs = [];
    }
  }

  const fromData = new Set<string>();
  existingHouseIds.forEach((id) => {
    const parts = (id || "").split("-");
    if (parts[1] && parts[1].startsWith("L")) fromData.add(parts[1].toUpperCase());
  });

  const all = Array.from(new Set([...defaults, ...customs, ...fromData]));
  return all.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });
}

export function saveCustomLane(lane: string) {
  if (typeof window === "undefined") return;
  const l = lane.trim().toUpperCase();
  if (!l) return;
  const current: string[] = JSON.parse(localStorage.getItem(CUSTOM_LANES_KEY) || "[]");
  if (!current.includes(l)) {
    current.push(l);
    localStorage.setItem(CUSTOM_LANES_KEY, JSON.stringify(current));
  }
}

/**
 * Creates House, Pin, and Members in Supabase
 */
export async function createHouseWithDetails(input: CreateHouseInput) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  // Enforce Role-Based Access Control on client before calling server
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "survey_user") {
    throw new Error("Unauthorized: Only CHW (Survey Users) can create new surveys.");
  }

  if (!userId) {
    throw new Error("You must be logged in to create a house.");
  }

  // Call the secure server function to bypass RLS issues
  const result = await commitCreateHouse({ data: { ...input, userId } });
  if (result.error) {
    throw new Error(result.error);
  }

  return { house: result.house, members: result.members };
}

const createHouseMemberSchema = z.object({
  name: z.string(),
  age: z.number().nullable(),
  gender: z.string(),
  phone: z.string().optional(),
  occupation: z.string().optional(),
});

const createHouseInputSchema = z.object({
  block: z.string(),
  lane: z.string(),
  serialNo: z.string(),
  housingType: z.string(),
  houseId: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  locationName: z.string().nullable().optional(),
  locationSource: z.string().nullable().optional(),
  pinType: z.string().optional(),
  customType: z.string().nullable().optional(),
  availability: z.enum(["AVAILABLE", "NOT_AVAILABLE"]),
  unavailableReason: z.string().nullable().optional(),
  monthlyIncome: z.number().nullable().optional(),
  earningMembers: z.number().nullable().optional(),
  totalMembers: z.number().nullable().optional(),
  members: z.array(createHouseMemberSchema),
  userId: z.string(),
});

export const commitCreateHouse = createServerFn({ method: "POST" })
  .validator(createHouseInputSchema)
  .handler(async ({ data: input }) => {
    const adminClient = getSupabaseAdmin();
    const userId = input.userId;

    // Server-side authorization check to ensure the user is genuinely a CHW
    const { data: userRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (userRole?.role !== "survey_user") {
      return { error: "Unauthorized: Only CHW (Survey Users) can create new surveys." };
    }

    // 1. Check uniqueness of House ID
    const { data: existingHouse } = await adminClient
      .from(tables.houses)
      .select("id")
      .eq("house_id", input.houseId)
      .maybeSingle();

    if (existingHouse) {
      return {
        error: `House ID "${input.houseId}" already exists. Please choose a different serial number.`,
      };
    }

    const hasLocation = input.latitude != null && input.longitude != null;
    const locationStatus = hasLocation ? "mapped" : "not_mapped";

    const housePayload = {
      house_id: input.houseId,
      house_number: input.serialNo,
      address: input.address ?? input.locationName ?? null,
      owner_name: input.members[0]?.name ?? null,
      status:
        input.availability === "AVAILABLE" ? "active" : input.unavailableReason || "unavailable",
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accuracy: input.accuracy ?? null,
      location_status: locationStatus,
      location_source: input.locationSource ?? (hasLocation ? "device_gps" : null),
      mapped_by: hasLocation ? userId : null,
      mapped_at: hasLocation ? new Date().toISOString() : null,
      pin_type: input.pinType ?? "house",
      custom_type: input.customType ?? null,
      monthly_income: input.monthlyIncome ?? null,
      earning_members: input.earningMembers ?? null,
      total_members: input.totalMembers ?? input.members.length,
      created_by: userId,
      data: {
        block: input.block,
        lane: input.lane,
        serial_no: input.serialNo,
        housing_type: input.housingType,
        availability: input.availability,
        unavailable_reason: input.unavailableReason ?? null,
      } as any,
    };

    // 2. Insert House
    const { data: createdHouse, error: houseError } = await adminClient
      .from(tables.houses)
      .insert(housePayload)
      .select("*")
      .single();

    if (houseError) return { error: houseError.message };

    // 3. Insert Pin if location present
    if (hasLocation) {
      await adminClient.from(tables.pins).insert({
        house_uuid: createdHouse.id,
        house_id: input.houseId,
        latitude: input.latitude!,
        longitude: input.longitude!,
        accuracy: input.accuracy ?? null,
        pin_type: input.pinType ?? "house",
        custom_type: input.customType ?? null,
        user_id: userId,
        source: "app_survey",
      });
    }

    // 4. Insert Members (Assigning Member IDs to age 30+ only)
    let count30Plus = 0;
    const createdMembers = [];

    const s = await getHealthThresholdSettings(false, userId, userRole?.role, null);
    const minAge = s.minimum_eligible_age ?? 30;

    for (const m of input.members) {
      const is30Plus = m.age != null && m.age >= minAge;
      let memberId: string | null = null;
      if (is30Plus) {
        count30Plus++;
        memberId = generateMemberId(input.houseId, count30Plus);
      }

      const memberPayload = {
        house_uuid: createdHouse.id,
        member_id: memberId,
        member_name: m.name.trim(),
        created_at: new Date().toISOString(),
        data: {
          name: m.name.trim(),
          age: m.age,
          gender: m.gender,
          phone: m.phone ?? null,
          occupation: m.occupation ?? null,
          eligible: is30Plus,
          house_id: input.houseId,
        } as any,
      };

      const { data: createdMember, error: memberError } = await adminClient
        .from(tables.houseMembers)
        .insert(memberPayload)
        .select("*")
        .single();

      if (memberError) {
        console.error("Failed to insert member:", memberError);
        continue;
      }
      createdMembers.push(createdMember);
    }

    // Log the activity
    await adminClient.from("activity_logs").insert({
      user_id: userId,
      action: "house.created",
      details: {
        house_id: input.houseId,
        total_members: input.members.length,
        eligible_30_plus: count30Plus,
      } as any,
    });

    return { house: createdHouse, members: createdMembers };
  });

/**
 * Updates House and cascade synchronizes linked Member IDs if house_id changed.
 */
export async function updateHouseWithDetails(houseUuid: string, input: Partial<CreateHouseInput>) {
  const { data: currentHouse, error: fetchErr } = await supabase
    .from(tables.houses)
    .select("*")
    .eq("id", houseUuid)
    .single();

  if (fetchErr) throw fetchErr;

  const newHouseId = input.houseId ?? currentHouse.house_id;
  const oldHouseId = currentHouse.house_id;
  const houseIdChanged = newHouseId && newHouseId !== oldHouseId;

  const updatePayload: Record<string, any> = {
    ["updated_at"]: new Date().toISOString(),
  };

  if (input.houseId !== undefined) updatePayload["house_id"] = input.houseId;
  if (input.address !== undefined) updatePayload["address"] = input.address;
  if (input.latitude !== undefined) updatePayload["latitude"] = input.latitude;
  if (input.longitude !== undefined) updatePayload["longitude"] = input.longitude;
  if (input.accuracy !== undefined) updatePayload["accuracy"] = input.accuracy;
  if (input.pinType !== undefined) updatePayload["pin_type"] = input.pinType;
  if (input.customType !== undefined) updatePayload["custom_type"] = input.customType;
  if (input.monthlyIncome !== undefined) updatePayload["monthly_income"] = input.monthlyIncome;
  if (input.earningMembers !== undefined) updatePayload["earning_members"] = input.earningMembers;
  if (input.totalMembers !== undefined) updatePayload["total_members"] = input.totalMembers;

  const { error: updateErr } = await supabase
    .from(tables.houses)
    .update(updatePayload)
    .eq("id", houseUuid);

  if (updateErr) throw updateErr;

  // If House ID changed, cascade-update all 30+ member IDs
  if (houseIdChanged) {
    const s = await getHealthThresholdSettings(false, null, null, null);
    const minAge = s.minimum_eligible_age ?? 30;

    const { data: members } = await supabase
      .from(tables.houseMembers)
      .select("*")
      .eq("house_uuid", houseUuid)
      .order("created_at", { ascending: true });

    if (members && members.length > 0) {
      let count30Plus = 0;
      for (const m of members) {
        const mData = (m.data ?? {}) as Record<string, any>;
        const age = mData["age"] != null ? Number(mData["age"]) : null;
        const is30Plus = age != null && age >= minAge;

        let newMemberId: string | null = null;
        if (is30Plus) {
          count30Plus++;
          newMemberId = generateMemberId(newHouseId, count30Plus);
        }

        await supabase
          .from(tables.houseMembers)
          .update({
            member_id: newMemberId,
            data: {
              ...mData,
              house_id: newHouseId,
              eligible: is30Plus,
            },
          })
          .eq("id", m.id);
      }
    }
  }

  await logActivity("house.updated", { house_uuid: houseUuid, house_id: newHouseId });
}

/**
 * Creates a standalone Map Point of Interest pin (e.g. Shop, Mosque, Hospital, Empty Land, etc.).
 */
export async function createStandalonePin(input: {
  pinType: string;
  customType?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string | null;
  ownerName?: string | null;
  houseId?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Enforce Role-Based Access Control
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "survey_user") {
    throw new Error("Unauthorized: Only CHW (Survey Users) can create map pins.");
  }

  const { data, error } = await supabase
    .from(tables.houses)
    .insert({
      house_id: input.houseId ?? null,
      house_number: null,
      address: input.address ?? null,
      owner_name: input.ownerName ?? null,
      status: "mapped",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      location_status: "pinned",
      location_source: "manual_map_pin",
      mapped_by: userId,
      mapped_at: new Date().toISOString(),
      pin_type: input.pinType,
      custom_type: input.customType ?? null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) throw error;
  await logActivity("pin.created", {
    id: data.id,
    pin_type: input.pinType,
    lat: input.latitude,
    lng: input.longitude,
  });
  return data;
}

/**
 * Links GPS coordinates and pin type to an existing House record (no duplicate created).
 */
export async function linkExistingHouseLocation(input: {
  houseUuid: string;
  pinType: string;
  customType?: string | null;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Enforce Role-Based Access Control
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "survey_user") {
    throw new Error("Unauthorized: Only CHW (Survey Users) can modify map pins.");
  }

  const updatePayload: Record<string, any> = {
    ["latitude"]: input.latitude,
    ["longitude"]: input.longitude,
    ["accuracy"]: input.accuracy ?? null,
    ["pin_type"]: input.pinType,
    ["custom_type"]: input.customType ?? null,
    ["location_status"]: "pinned",
    ["location_source"]: "manual_map_pin",
    ["mapped_by"]: userId,
    ["mapped_at"]: new Date().toISOString(),
    ["updated_at"]: new Date().toISOString(),
  };

  if (input.address) {
    updatePayload["address"] = input.address;
  }

  const { data, error } = await supabase
    .from(tables.houses)
    .update(updatePayload)
    .eq("id", input.houseUuid)
    .select("*")
    .single();

  if (error) throw error;
  await logActivity("house.location_linked", {
    house_uuid: input.houseUuid,
    pin_type: input.pinType,
    lat: input.latitude,
    lng: input.longitude,
  });
  return data;
}

/**
 * Admin: Transfer a single house to a different user.
 */
export async function transferHouse(houseUuid: string, newUserId: string | null) {
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "admin" && sessionUser?.role !== "supervisor") {
    throw new Error("Unauthorized: Only Admins or Supervisors can transfer houses.");
  }

  const { error } = await supabase
    .from(tables.houses)
    .update({ mapped_by: newUserId, updated_at: new Date().toISOString() })
    .eq("id", houseUuid);

  if (error) throw error;
  await logActivity("house.transferred", { house_uuid: houseUuid, new_user_id: newUserId });
}

/**
 * Admin: Bulk transfer houses to a different user.
 */
export async function bulkTransferHouses(houseUuids: string[], newUserId: string | null) {
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "admin" && sessionUser?.role !== "supervisor") {
    throw new Error("Unauthorized: Only Admins or Supervisors can transfer houses.");
  }

  const { error } = await supabase
    .from(tables.houses)
    .update({ mapped_by: newUserId, updated_at: new Date().toISOString() })
    .in("id", houseUuids);

  if (error) throw error;
  await logActivity("house.bulk_transferred", { house_uuids: houseUuids, new_user_id: newUserId });
}

/**
 * Admin: Delete a single house safely.
 */
export async function deleteHouse(houseUuid: string) {
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "admin") {
    throw new Error("Unauthorized: Only Admins can delete houses.");
  }

  // Note: relies on ON DELETE CASCADE in Supabase schema for related records (members, assessments).
  const { error } = await supabase.from(tables.houses).delete().eq("id", houseUuid);

  if (error) throw error;
  await logActivity("house.deleted", { house_uuid: houseUuid });
}

/**
 * Admin: Bulk delete houses.
 */
export async function bulkDeleteHouses(houseUuids: string[]) {
  const sessionUser = await loadSessionUser();
  if (sessionUser?.role !== "admin") {
    throw new Error("Unauthorized: Only Admins can delete houses.");
  }

  const { error } = await supabase.from(tables.houses).delete().in("id", houseUuids);

  if (error) throw error;
  await logActivity("house.bulk_deleted", { house_uuids: houseUuids });
}
