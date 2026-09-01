import { getSupabaseAdmin } from "./src/lib/supabaseAdmin.js";
import 'dotenv/config';

async function listRpc() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('reload_schema_cache');
  console.log("RPC result:", error || "success");
}
listRpc();
