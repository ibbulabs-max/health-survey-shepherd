import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkTable(tableName) {
  const { error } = await supabase.from(tableName).select("*").limit(1);
  if (error && error.code === 'PGRST205') {
    return "Not Found";
  } else if (error) {
    return `Exists (Error: ${error.message})`;
  }
  return "Exists";
}

async function run() {
  const tables = [
    "profiles",
    "user_roles",
    "houses",
    "house_members",
    "member_assessments",
    "follow_ups",
    "tasks",
    "pins",
    "imports",
    "import_rows",
    "map_areas",
    "audit_logs",
    "user_settings",
    "health_threshold_settings",
    "global_settings",
    "system_alerts",
    "analytics_dashboards",
    "analytics_dashboard_groups",
    "analytics_dashboard_widgets",
    "analytics_widget_configs"
  ];

  console.log("=== SCHEMA GAP ASSESSMENT ===");
  for (const t of tables) {
    const status = await checkTable(t);
    console.log(`${t.padEnd(30, " ")}: ${status}`);
  }
}

run();
