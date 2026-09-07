import { config } from "dotenv";
config();
import { getSupabaseAdmin } from "../src/lib/supabaseAdmin";
import { tables } from "../src/config/database";

async function run() {
  const adminClient = getSupabaseAdmin();
  const { data: batches } = await adminClient.from(tables.importBatches).select("*");
  console.log("Batches:", JSON.stringify(batches, null, 2));
}
run();
