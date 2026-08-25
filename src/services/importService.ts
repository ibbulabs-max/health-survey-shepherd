import * as XLSX from "xlsx";

import { tables } from "@/config/database";
import { importConfig, normaliseHeader } from "@/config/importing";
import { supabase } from "@/db/client";
import type { House, HouseMember, ImportBatch, Json, JsonObject } from "@/db/types";
import { nameSimilarity, numberOrNull, toStringArray } from "@/lib/domain";
import { logActivity } from "@/services/activityService";

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

export async function parseFiles(files: File[]): Promise<{
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
          const canonical = aliasLookup.get(normaliseHeader(header));
          if (canonical) {
            mapped[canonical] = value;
          } else {
            const clean = header.trim();
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
  const address = String(row["address"] ?? "").trim().toLowerCase();
  const owner = String(row["owner_name"] ?? "").trim().toLowerCase();
  return `addr:${address}|${owner}` || "unknown";
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

export async function buildPreview(files: File[]): Promise<ImportPreview> {
  const { rows, unmappedHeaders } = await parseFiles(files);
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
    "owner_name",
    "latitude",
    "longitude",
    "total_members",
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
    house.hasLocation =
      numberOrNull(house.fields["latitude"]) != null &&
      numberOrNull(house.fields["longitude"]) != null;

    const name = String(row.mapped["member_name"] ?? "").trim();
    if (!name) return;

    const memberFields: Record<string, unknown> = {};
    [
      "member_id",
      "age",
      "gender",
      "systolic",
      "diastolic",
      "blood_sugar",
      "known_history",
      "medication",
      "height_cm",
      "weight_kg",
      "waist",
      "smoking",
      "alcohol",
      "tobacco",
      "physical_activity",
      "screening_date",
      "surveyor",
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

    let best: { member: HouseMember; score: number; reason: string } | null = null;
    (existingMembersByHouse.get(existing?.id ?? "") ?? []).forEach((m) => {
      const data = (m.data ?? {}) as Record<string, unknown>;
      const result = identityConfidence(candidate, {
        name: m.member_name ?? "",
        age: numberOrNull(data["age"]),
        gender: (data["gender"] as string | undefined) ?? null,
        memberId: m.member_id,
      });
      if (!best || result.score > best.score)
        best = { member: m, score: result.score, reason: result.reason };
    });

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
    },
  };
}

export interface CommitOptions {
  /** memberKey -> decision chosen by the user for "review" matches. */
  decisions?: Record<string, "insert" | "merge">;
  assignedTo?: string | null;
  supervisorId?: string | null;
}

export async function commitImport(
  preview: ImportPreview,
  options: CommitOptions = {},
): Promise<ImportBatch> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const username = auth.user?.email?.split("@")[0] ?? null;

  const { data: batch, error: batchError } = await supabase
    .from(tables.importBatches)
    .insert({
      file_names: preview.files as unknown as Json,
      uploaded_by: userId,
      uploaded_by_name: username,
      assigned_to: options.assignedTo ?? null,
      supervisor_id: options.supervisorId ?? null,
      total_rows: preview.totals.rows,
      unique_houses: preview.totals.houses,
      new_fields: preview.newFields as unknown as Json,
      status: "processing",
    })
    .select("*")
    .single();
  if (batchError) throw batchError;

  let housesAdded = 0;
  let housesUpdated = 0;
  let membersAdded = 0;
  let membersMerged = 0;

  for (const house of preview.houses) {
    const lat = numberOrNull(house.fields["latitude"]);
    const lng = numberOrNull(house.fields["longitude"]);
    const housePayload = {
      house_id: (house.fields["house_id"] as string | undefined)?.toString() ?? null,
      house_number: (house.fields["house_number"] as string | undefined)?.toString() ?? null,
      address: (house.fields["address"] as string | undefined)?.toString() ?? null,
      owner_name: (house.fields["owner_name"] as string | undefined)?.toString() ?? null,
      total_members: numberOrNull(house.fields["total_members"]),
      latitude: lat,
      longitude: lng,
      location_status: lat != null && lng != null ? "mapped" : "unmapped",
      location_source: lat != null && lng != null ? "import" : null,
      data: house.extra as unknown as JsonObject,
      source_files: house.sourceFiles as unknown as Json,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
      assigned_csw_id: options.assignedTo ?? null,
      supervisor_id: options.supervisorId ?? null,
    };

    let houseUuid = house.existingId;
    if (houseUuid) {
      const clean = Object.fromEntries(
        Object.entries(housePayload).filter(([, v]) => v != null),
      );
      const { error } = await supabase.from(tables.houses).update(clean).eq("id", houseUuid);
      if (error) throw error;
      housesUpdated += 1;
    } else {
      const { data, error } = await supabase
        .from(tables.houses)
        .insert({ ...housePayload, created_by: userId })
        .select("id")
        .single();
      if (error) throw error;
      houseUuid = data.id;
      housesAdded += 1;
    }

    for (const member of house.members) {
      const decision = options.decisions?.[member.key];
      const action =
        member.action === "review" ? (decision ?? "insert") : member.action;
      const data = { ...member.fields, ...member.extra } as unknown as JsonObject;

      if (action === "merge" && member.existingId) {
        const { data: existing } = await supabase
          .from(tables.houseMembers)
          .select("data")
          .eq("id", member.existingId)
          .maybeSingle();
        const merged = {
          ...((existing?.data ?? {}) as JsonObject),
          ...data,
        } as unknown as JsonObject;
        const { error } = await supabase
          .from(tables.houseMembers)
          .update({
            member_name: member.name,
            data: merged,
            source_files: member.sourceFiles as unknown as Json,
            possible_duplicate: member.matchConfidence < importConfig.identity.autoMatch,
            updated_at: new Date().toISOString(),
          })
          .eq("id", member.existingId);
        if (error) throw error;
        membersMerged += 1;
      } else {
        const { error } = await supabase.from(tables.houseMembers).insert({
          house_uuid: houseUuid,
          member_id: member.memberId,
          member_name: member.name,
          data,
          source_files: member.sourceFiles as unknown as Json,
          uploaded_by: userId,
          uploaded_at: new Date().toISOString(),
          possible_duplicate: member.action === "review",
        });
        if (error) throw error;
        membersAdded += 1;
      }
    }
  }

  if (preview.conflicts.length) {
    const rows = preview.conflicts.map((c) => ({
      batch_id: batch.id,
      entity: c.entity,
      house_id: c.label,
      member_ref: c.memberKey ?? null,
      field: c.field,
      existing_value: c.existingValue,
      new_value: c.newValue,
      source_file: c.sourceFile,
      status: "open",
    }));
    const { error } = await supabase.from(tables.importConflicts).insert(rows);
    if (error) throw error;
  }

  const { data: finished, error: finishError } = await supabase
    .from(tables.importBatches)
    .update({
      houses_added: housesAdded,
      houses_updated: housesUpdated,
      members_added: membersAdded,
      members_merged: membersMerged,
      merged_records: membersMerged,
      conflicts: preview.conflicts.length,
      unmapped_houses: preview.totals.withoutLocation,
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .select("*")
    .single();
  if (finishError) throw finishError;

  await logActivity("import.completed", {
    batch_id: batch.id,
    houses_added: housesAdded,
    members_added: membersAdded,
  });

  return finished as ImportBatch;
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
