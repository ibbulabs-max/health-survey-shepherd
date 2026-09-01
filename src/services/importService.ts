import * as XLSX from "xlsx";

import { tables } from "@/config/database";
import { importConfig, normaliseHeader } from "@/config/importing";
import { supabase } from "@/db/client";
import type { House, HouseMember, ImportBatch, Json, JsonObject } from "@/db/types";
import { nameSimilarity, numberOrNull, toStringArray, calculateRisk } from "@/lib/domain";
import { logActivity } from "@/services/activityService";
import { scheduleFollowUp } from "@/services/followUpService";
import type { RiskLevel } from "@/config/risk";

/* -------------------------------------------------------------------------- */
/* Smart import: parse -> normalise -> match identities -> preview -> commit   */
/* -------------------------------------------------------------------------- */

export interface ParsedRow {
  sourceFile: string;
  sheet: string;
  rowNumber: number;
  mapped: Record<string, unknown>;
  extra: Record<string, unknown>;
}

export interface ImportPreview {
  rows: ParsedRow[];
  files: string[];
  newFields: string[];
  unmappedHeaders: Record<string, string[]>;
  houses: PreviewHouse[];
  conflicts: PreviewConflict[];
  duplicateRows: number;
  totals: {
    rows: number;
    houses: number;
    housesNew: number;
    housesExisting: number;
    members: number;
    membersNew: number;
    membersMerged: number;
    possibleMatches: number;
    withoutLocation: number;
    invalidCoordinates: number;
  };
}

export interface PreviewMember {
  key: string;
  name: string;
  memberId: string | null;
  fields: Record<string, unknown>;
  extra: Record<string, unknown>;
  existingId: string | null;
  matchConfidence: number;
  matchReason: string;
  action: "insert" | "merge" | "review";
  sourceFiles: string[];
}

export interface PreviewHouse {
  key: string;
  houseId: string | null;
  fields: Record<string, unknown>;
  extra: Record<string, unknown>;
  existingId: string | null;
  action: "insert" | "merge";
  members: PreviewMember[];
  sourceFiles: string[];
  hasLocation: boolean;
  hasInvalidCoordinates: boolean;
}

export interface PreviewConflict {
  entity: "house" | "member";
  houseKey: string;
  memberKey?: string;
  label: string;
  field: string;
  existingValue: string;
  newValue: string;
  sourceFile: string;
}

const aliasLookup = (() => {
  const map = new Map<string, string>();
  Object.entries(importConfig.aliases).forEach(([canonical, aliases]) => {
    map.set(normaliseHeader(canonical), canonical);
    aliases.forEach((a) => map.set(normaliseHeader(a), canonical));
  });
  return map;
})();

/**
 * Validate geographic coordinates.
 * Latitude must be -90 to 90, longitude -180 to 180.
 * Returns null if invalid or out of range.
 */
function validCoord(value: unknown, type: "lat" | "lng"): number | null {
  const n = numberOrNull(value);
  if (n == null) return null;
  if (type === "lat" && (n < -90 || n > 90)) return null;
  if (type === "lng" && (n < -180 || n > 180)) return null;
  return n;
}

export async function extractHeaders(files: File[]): Promise<{
  allHeaders: string[];
  unmappedHeaders: string[];
  suggestedMapping: Record<string, string>;
}> {
  const headers = new Set<string>();
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length > 0 && json[0]) {
        Object.keys(json[0]).forEach((k) => headers.add(k.trim()));
      }
    });
  }

  const allHeaders = Array.from(headers);
  const unmappedHeaders: string[] = [];
  const suggestedMapping: Record<string, string> = {};

  // Fuzzy match logic
  const targetCanonical = Object.keys(importConfig.aliases);

  allHeaders.forEach((header) => {
    const canonical = aliasLookup.get(normaliseHeader(header));
    if (canonical) {
      suggestedMapping[header] = canonical;
    } else {
      unmappedHeaders.push(header);

      // Try fuzzy matching (Levenshtein) to targetCanonical
      let bestMatch = "";
      let bestScore = 0;
      targetCanonical.forEach((tc) => {
        const score = nameSimilarity(header, tc);
        if (score > 0.7 && score > bestScore) {
          bestScore = score;
          bestMatch = tc;
        }
      });
      if (bestMatch) {
        suggestedMapping[header] = bestMatch;
      }
    }
  });

  return { allHeaders, unmappedHeaders, suggestedMapping };
}

export async function parseFiles(
  files: File[],
  customMappings: Record<string, string> = {},
): Promise<{
  rows: ParsedRow[];
  unmappedHeaders: Record<string, string[]>;
}> {
  const rows: ParsedRow[] = [];
  const unmappedHeaders: Record<string, string[]> = {};

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { cellDates: true });
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      json.forEach((raw, index) => {
        const mapped: Record<string, unknown> = {};
        const extra: Record<string, unknown> = {};
        Object.entries(raw).forEach(([header, value]) => {
          if (value === "" || value == null) return;
          const clean = header.trim();
          const canonical = customMappings[clean] || aliasLookup.get(normaliseHeader(header));
          if (canonical) {
            mapped[canonical] = value;
          } else {
            extra[clean] = value;
            unmappedHeaders[clean] = Array.from(
              new Set([...(unmappedHeaders[clean] ?? []), file.name]),
            );
          }
        });
        if (Object.keys(mapped).length === 0 && Object.keys(extra).length === 0) return;
        rows.push({
          sourceFile: file.name,
          sheet: sheetName,
          rowNumber: index + 2,
          mapped,
          extra,
        });
      });
    });
  }

  return { rows, unmappedHeaders };
}

const splitBp = (row: Record<string, unknown>) => {
  const raw = row["blood_pressure"];
  if (!raw || row["systolic"] != null) return;
  const match = String(raw).match(/(\d{2,3})\s*[/\\-]\s*(\d{2,3})/);
  if (match) {
    row["systolic"] = Number(match[1]);
    row["diastolic"] = Number(match[2]);
  }
};

const houseKeyOf = (row: Record<string, unknown>) => {
  const id = row["house_id"] ?? row["house_number"];
  if (id) return `id:${String(id).trim().toLowerCase()}`;
  const address = String(row["address"] ?? "")
    .trim()
    .toLowerCase();
  const owner = String(row["owner_name"] ?? "")
    .trim()
    .toLowerCase();

  if (!address && !owner) return "unknown";
  return `addr:${address}|${owner}`;
};

function identityConfidence(
  candidate: { name: string; age: number | null; gender: string | null; memberId: string | null },
  existing: { name: string; age: number | null; gender: string | null; memberId: string | null },
) {
  const w = importConfig.identity.weights;
  if (candidate.memberId && existing.memberId) {
    if (candidate.memberId.toLowerCase() === existing.memberId.toLowerCase())
      return { score: 1, reason: "Same Member ID" };
  }
  let score = 0;
  const reasons: string[] = [];
  const nameScore = nameSimilarity(candidate.name, existing.name);
  score += nameScore * w.name;
  if (nameScore > 0.85) reasons.push("name matches");

  if (candidate.age != null && existing.age != null) {
    const diff = Math.abs(candidate.age - existing.age);
    if (diff <= importConfig.identity.maxAgeDifference) {
      score += w.age * (1 - diff / (importConfig.identity.maxAgeDifference + 1));
      reasons.push(diff === 0 ? "same age" : `age within ${diff}y`);
    }
  }
  if (candidate.gender && existing.gender) {
    if (candidate.gender.toLowerCase()[0] === existing.gender.toLowerCase()[0]) {
      score += w.gender;
      reasons.push("same gender");
    }
  }
  score += w.house; // same house context by construction
  reasons.push("same household");

  return { score: Math.min(1, score), reason: reasons.join(", ") };
}

export async function buildPreview(
  files: File[],
  customMappings: Record<string, string> = {},
): Promise<ImportPreview> {
  const { rows, unmappedHeaders } = await parseFiles(files, customMappings);
  rows.forEach((r) => splitBp(r.mapped));

  const [{ data: existingHouses }, { data: existingMembers }] = await Promise.all([
    supabase.from(tables.houses).select("*"),
    supabase.from(tables.houseMembers).select("*"),
  ]);

  const houseRows = (existingHouses ?? []) as House[];
  const memberRows = (existingMembers ?? []) as HouseMember[];

  const existingHouseByKey = new Map<string, House>();
  houseRows.forEach((h) => {
    if (h.house_id) existingHouseByKey.set(`id:${h.house_id.trim().toLowerCase()}`, h);
    if (h.house_number) existingHouseByKey.set(`id:${h.house_number.trim().toLowerCase()}`, h);
    const addr = `addr:${(h.address ?? "").trim().toLowerCase()}|${(h.owner_name ?? "").trim().toLowerCase()}`;
    if (!existingHouseByKey.has(addr)) existingHouseByKey.set(addr, h);
  });

  const existingMembersByHouse = new Map<string, HouseMember[]>();
  memberRows.forEach((m) => {
    const key = m.house_uuid ?? "";
    existingMembersByHouse.set(key, [...(existingMembersByHouse.get(key) ?? []), m]);
  });

  const houses = new Map<string, PreviewHouse>();
  const conflicts: PreviewConflict[] = [];
  let duplicateRows = 0;

  const houseFieldKeys = [
    "house_id",
    "house_number",
    "address",
    "address_line2",
    "landmark",
    "locality",
    "city",
    "ward_no",
    "district",
    "state",
    "pin_code",
    "owner_name",
    "latitude",
    "longitude",
    "total_members",
    "housing_type",
    "resident_type",
    "settlement_type",
    "consent_status",
    "monthly_income",
    "earning_members",
  ];

  rows.forEach((row) => {
    const key = houseKeyOf(row.mapped);
    const existing = existingHouseByKey.get(key) ?? null;

    let house = houses.get(key);
    if (!house) {
      house = {
        key,
        houseId: (row.mapped["house_id"] as string | undefined)?.toString() ?? null,
        fields: {},
        extra: {},
        existingId: existing?.id ?? null,
        action: existing ? "merge" : "insert",
        members: [],
        sourceFiles: [],
        hasLocation: false,
        hasInvalidCoordinates: false,
      };
      houses.set(key, house);
    }
    if (!house.sourceFiles.includes(row.sourceFile)) house.sourceFiles.push(row.sourceFile);

    houseFieldKeys.forEach((field) => {
      const value = row.mapped[field];
      if (value == null || value === "") return;
      const current = house!.fields[field];
      if (current != null && String(current) !== String(value)) {
        conflicts.push({
          entity: "house",
          houseKey: key,
          label: house!.houseId ?? key,
          field,
          existingValue: String(current),
          newValue: String(value),
          sourceFile: row.sourceFile,
        });
        return;
      }
      if (current == null) house!.fields[field] = value;
      const existingValue = existing?.[field as keyof House];
      if (
        existing &&
        existingValue != null &&
        String(existingValue) !== String(value) &&
        !conflicts.some((c) => c.houseKey === key && c.field === field)
      ) {
        conflicts.push({
          entity: "house",
          houseKey: key,
          label: existing.house_id ?? key,
          field,
          existingValue: String(existingValue),
          newValue: String(value),
          sourceFile: row.sourceFile,
        });
      }
    });

    Object.assign(house.extra, row.extra);

    // Validate coordinates strictly: lat -90..90, lng -180..180
    const rawLat = house.fields["latitude"];
    const rawLng = house.fields["longitude"];
    const lat = validCoord(rawLat, "lat");
    const lng = validCoord(rawLng, "lng");

    if (lat != null && lng != null) {
      house.hasLocation = true;
      house.hasInvalidCoordinates = false;
    } else if (rawLat != null || rawLng != null) {
      house.hasInvalidCoordinates = true;
      house.hasLocation = false;
    }

    const name = String(row.mapped["member_name"] ?? "").trim();
    if (!name) return;

    const memberFields: Record<string, unknown> = {};
    [
      "member_id",
      "age",
      "gender",
      "eligible", // Excel: Eligible (≥30) — Yes/No
      "systolic",
      "diastolic",
      "blood_sugar",
      "known_history",
      "medication",
      "height_cm",
      "weight_kg",
      "bmi",
      "bmi_category",
      "waist",
      "smoking",
      "alcohol",
      "tobacco",
      "physical_activity",
      "pulse",
      "spo2",
      "screening_date", // Excel: Screening Date — primary follow-up anchor
      "survey_date", // Excel: Survey Date — fallback follow-up anchor
      "clinical_risk", // Excel: Clinical Risk — LOW/MODERATE/HIGH (primary risk source)
      "lifestyle_risk",
      "lifestyle_score",
      "assessment_basis",
      "screening_comments",
      "surveyor",
      "follow_ups", // Excel: Follow-ups (text history)
      "follow_up_count", // Excel: Follow-up Count
      "referrals", // Excel: Referrals
      "referral_count", // Excel: Referral Count
    ].forEach((f) => {
      if (row.mapped[f] != null && row.mapped[f] !== "") memberFields[f] = row.mapped[f];
    });

    const candidate = {
      name,
      age: numberOrNull(memberFields["age"]),
      gender: (memberFields["gender"] as string | undefined) ?? null,
      memberId: (memberFields["member_id"] as string | undefined)?.toString() ?? null,
    };

    // De-dup within this import
    const sameInBatch = house.members.find(
      (m) =>
        identityConfidence(candidate, {
          name: m.name,
          age: numberOrNull(m.fields["age"]),
          gender: (m.fields["gender"] as string | undefined) ?? null,
          memberId: m.memberId,
        }).score >= importConfig.identity.autoMatch,
    );
    if (sameInBatch) {
      duplicateRows += 1;
      Object.entries(memberFields).forEach(([field, value]) => {
        const current = sameInBatch.fields[field];
        if (current == null) {
          sameInBatch.fields[field] = value;
        } else if (String(current) !== String(value)) {
          conflicts.push({
            entity: "member",
            houseKey: key,
            memberKey: sameInBatch.key,
            label: sameInBatch.name,
            field,
            existingValue: String(current),
            newValue: String(value),
            sourceFile: row.sourceFile,
          });
        }
      });
      Object.assign(sameInBatch.extra, row.extra);
      if (!sameInBatch.sourceFiles.includes(row.sourceFile))
        sameInBatch.sourceFiles.push(row.sourceFile);
      return;
    }

    const candidates: { member: HouseMember; score: number; reason: string }[] = [];

    // Check members in the same house
    (existingMembersByHouse.get(existing?.id ?? "") ?? []).forEach((m) => {
      const data = (m.data ?? {}) as Record<string, unknown>;
      const result = identityConfidence(candidate, {
        name: m.member_name ?? "",
        age: numberOrNull(data["age"]),
        gender: (data["gender"] as string | undefined) ?? null,
        memberId: m.member_id,
      });
      candidates.push({ member: m, score: result.score, reason: result.reason });
    });

    let best = candidates.sort((a, b) => b.score - a.score)[0] ?? null;

    // Search globally if no match in same house
    if (!best || best.score < importConfig.identity.possibleMatch) {
      const globalCandidates: { member: HouseMember; score: number; reason: string }[] = [];
      const hasMemberId = Boolean(candidate.memberId && candidate.memberId.trim().length > 0);

      memberRows.forEach((m) => {
        if (existing?.id === m.house_uuid) return;
        const data = (m.data ?? {}) as Record<string, unknown>;

        if (!hasMemberId) {
          const sim = nameSimilarity(candidate.name, m.member_name ?? "");
          if (sim < 0.7) return;
        }

        const result = identityConfidence(candidate, {
          name: m.member_name ?? "",
          age: numberOrNull(data["age"]),
          gender: (data["gender"] as string | undefined) ?? null,
          memberId: m.member_id,
        });

        if (result.score >= importConfig.identity.possibleMatch) {
          globalCandidates.push({
            member: m,
            score: result.score,
            reason: `${result.reason} (Different House)`,
          });
        }
      });

      const bestGlobal = globalCandidates.sort((a, b) => b.score - a.score)[0];
      if (bestGlobal && (!best || bestGlobal.score > best.score)) {
        best = bestGlobal;
      }
    }

    const score = best?.score ?? 0;
    const action: PreviewMember["action"] =
      score >= importConfig.identity.autoMatch
        ? "merge"
        : score >= importConfig.identity.possibleMatch
          ? "review"
          : "insert";

    house.members.push({
      key: `${key}:${house.members.length}:${name.toLowerCase()}`,
      name,
      memberId: candidate.memberId,
      fields: memberFields,
      extra: { ...row.extra },
      existingId: action === "insert" ? null : (best?.member.id ?? null),
      matchConfidence: score,
      matchReason: best?.reason ?? "No similar record found",
      action,
      sourceFiles: [row.sourceFile],
    });
  });

  const houseList = [...houses.values()];
  const memberList = houseList.flatMap((h) => h.members);

  return {
    rows,
    files: [...new Set(rows.map((r) => r.sourceFile))],
    newFields: Object.keys(unmappedHeaders),
    unmappedHeaders,
    houses: houseList,
    conflicts,
    duplicateRows,
    totals: {
      rows: rows.length,
      houses: houseList.length,
      housesNew: houseList.filter((h) => h.action === "insert").length,
      housesExisting: houseList.filter((h) => h.action === "merge").length,
      members: memberList.length,
      membersNew: memberList.filter((m) => m.action === "insert").length,
      membersMerged: memberList.filter((m) => m.action === "merge").length,
      possibleMatches: memberList.filter((m) => m.action === "review").length,
      withoutLocation: houseList.filter((h) => !h.hasLocation).length,
      invalidCoordinates: houseList.filter((h) => h.hasInvalidCoordinates).length,
    },
  };
}

import { startImportJob } from "@/services/importBackendService";

export interface CommitOptions {
  /** memberKey -> decision chosen by the user for "review" matches. */
  decisions?: Record<string, "insert" | "merge">;
  assignedTo?: string | null;
  assignedToName?: string | null;
  supervisorId?: string | null;
  onProgress?: (progress: {
    stage: string;
    current: number;
    total: number;
    batch?: number;
    totalBatches?: number;
  }) => void;
  signal?: AbortSignal;
}

/**
 * Triggers server-side background execution for the import job.
 * Returns immediately with batchId and status: 'processing'.
 */
export async function commitImport(
  preview: ImportPreview,
  options: CommitOptions = {},
): Promise<{ success: boolean; batchId: string; status: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const username = auth.user?.email?.split("@")[0] ?? null;
  if (!userId) throw new Error("Must be logged in to import data.");

  options.onProgress?.({
    stage: "Starting background job on server...",
    current: 0,
    total: preview.totals.rows,
  });

  const housesPayload = preview.houses.map((h) => ({
    key: h.key,
    houseId: h.houseId,
    fields: h.fields,
    extra: h.extra,
    existingId: h.existingId,
    action: h.action,
    sourceFiles: h.sourceFiles,
    hasLocation: h.hasLocation,
    hasInvalidCoordinates: h.hasInvalidCoordinates,
    members: h.members.map((m) => ({
      key: m.key,
      name: m.name,
      memberId: m.memberId,
      fields: m.fields,
      extra: m.extra,
      existingId: m.existingId,
      matchConfidence: m.matchConfidence,
      action: m.action,
      sourceFiles: m.sourceFiles,
    })),
  }));

  const conflictsPayload = preview.conflicts.map((c) => ({
    entity: c.entity,
    houseKey: c.houseKey,
    memberKey: c.memberKey,
    label: c.label,
    field: c.field,
    existingValue: c.existingValue,
    newValue: c.newValue,
    sourceFile: c.sourceFile,
  }));

  const result = await startImportJob({
    data: {
      fileNames: preview.files,
      userId,
      username,
      assignedTo: options.assignedTo ?? null,
      assignedToName: options.assignedToName ?? null,
      supervisorId: options.supervisorId ?? null,
      totalRows: preview.totals.rows,
      uniqueHouses: preview.totals.houses,
      newFields: preview.newFields,
      houses: housesPayload,
      conflicts: conflictsPayload,
      decisions: options.decisions,
    },
  });

  return result;
}

export async function loadImportBatches(limit = 50) {
  const { data, error } = await supabase
    .from(tables.importBatches)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ImportBatch[];
}

export const conditionsFromRow = (value: unknown) => toStringArray(value);
