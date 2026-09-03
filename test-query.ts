import { getSupabaseAdmin } from "./src/lib/supabaseAdmin.ts";
import { tables } from "./src/config/database.ts";

async function test() {
  const adminClient = getSupabaseAdmin();
  const { data, error } = await adminClient
    .from(tables.houseMembers)
    .select("id, source_files")
    .contains("source_files", ["test.xlsx"]);

  console.log("Error:", error);
  console.log("Data:", data);
}

test();
