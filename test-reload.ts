import { getSupabaseAdmin } from "./src/lib/supabaseAdmin.js";

async function reload() {
  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc("reload_schema_cache", {});
  if (error) {
    console.log("No rpc, let's just do a dummy query");
    // Actually we can't run raw SQL from the JS client easily.
  }
}
reload();
