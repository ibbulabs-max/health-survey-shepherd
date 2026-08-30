import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { tables } from "../src/config/database";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["'](.*)["']$/, "$1");
        process.env[key] = value;
      }
    }
  }
}

async function runDedupe() {
  loadEnv();
  const url = process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(url, key);

  console.log("Starting Deduplication Process...");

  // 1. Fetch all houses
  const { data: houses, error: hError } = await supabase.from(tables.houses).select("*");
  if (hError) throw hError;

  // Group houses by house_id
  const housesById = new Map<string, any[]>();
  for (const h of houses) {
    if (!h.house_id) continue;
    const list = housesById.get(h.house_id) || [];
    list.push(h);
    housesById.set(h.house_id, list);
  }

  // Find duplicates
  for (const [houseId, copies] of housesById.entries()) {
    if (copies.length > 1) {
      // Sort by created_at ascending so the oldest is canonical
      copies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const canonical = copies[0];
      const duplicates = copies.slice(1);

      console.log(`Found duplicate houses for house_id: ${houseId} (Canonical: ${canonical.id})`);

      for (const dup of duplicates) {
        // Move members to canonical house
        const { data: members } = await supabase
          .from(tables.houseMembers)
          .select("*")
          .eq("house_uuid", dup.id);

        if (members && members.length > 0) {
          console.log(
            `  Moving ${members.length} members from duplicate ${dup.id} to ${canonical.id}`,
          );
          for (const m of members) {
            // Check if member already exists in canonical house (by member_id)
            const { data: existingM } = await supabase
              .from(tables.houseMembers)
              .select("id")
              .eq("house_uuid", canonical.id)
              .eq("member_id", m.member_id)
              .maybeSingle();

            if (existingM) {
              console.log(
                `    Member ${m.member_id} already exists in canonical house, merging/keeping oldest.`,
              );
              // We just delete the duplicate member record and re-point any related data?
              // The easiest is just delete the duplicate member. But wait, does it have assessments?
              // Let's just update assessments to point to canonical member?
              // It's safer to re-parent the member's assessments/followups.

              // Move assessments
              await supabase
                .from(tables.memberAssessments)
                .update({ house_uuid: canonical.id, member_uuid: existingM.id })
                .eq("member_uuid", m.id);
              // Move follow-ups
              await supabase
                .from(tables.followUps)
                .update({ house_uuid: canonical.id, member_uuid: existingM.id })
                .eq("member_uuid", m.id);
              // Delete the dup member
              await supabase.from(tables.houseMembers).delete().eq("id", m.id);
            } else {
              // Re-parent member
              await supabase
                .from(tables.houseMembers)
                .update({ house_uuid: canonical.id })
                .eq("id", m.id);
              // Re-parent related tables
              await supabase
                .from(tables.memberAssessments)
                .update({ house_uuid: canonical.id })
                .eq("member_uuid", m.id);
              await supabase
                .from(tables.followUps)
                .update({ house_uuid: canonical.id })
                .eq("member_uuid", m.id);
            }
          }
        }

        // Re-parent tasks if any
        await supabase
          .from(tables.tasks)
          .update({ house_uuid: canonical.id })
          .eq("house_uuid", dup.id);

        // Delete duplicate house
        console.log(`  Deleting duplicate house ${dup.id}`);
        await supabase.from(tables.houses).delete().eq("id", dup.id);
      }
    }
  }

  console.log("House deduplication complete.");

  // 2. Dedupe members within same house (in case there are existing duplicates)
  console.log("Checking for duplicate members within the same house...");
  const { data: allMembers, error: mError } = await supabase.from(tables.houseMembers).select("*");
  if (mError) throw mError;

  const membersByKey = new Map<string, any[]>();
  for (const m of allMembers) {
    if (!m.member_id) continue;
    const key = `${m.house_uuid}-${m.member_id}`;
    const list = membersByKey.get(key) || [];
    list.push(m);
    membersByKey.set(key, list);
  }

  for (const [key, copies] of membersByKey.entries()) {
    if (copies.length > 1) {
      copies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const canonical = copies[0];
      const duplicates = copies.slice(1);

      for (const dup of duplicates) {
        console.log(`Merging duplicate member ${dup.member_id} in house ${dup.house_uuid}`);
        await supabase
          .from(tables.memberAssessments)
          .update({ member_uuid: canonical.id })
          .eq("member_uuid", dup.id);
        await supabase
          .from(tables.followUps)
          .update({ member_uuid: canonical.id })
          .eq("member_uuid", dup.id);
        await supabase.from(tables.houseMembers).delete().eq("id", dup.id);
      }
    }
  }
  console.log("Member deduplication complete.");
}

runDedupe().catch(console.error);
