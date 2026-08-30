import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = fs
  .readFileSync(".env", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const [k, v] = line.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const t1 = await supabase.from("settings").select("*").limit(1);
  const t2 = await supabase.from("follow_up_settings").select("*").limit(1);
  const t3 = await supabase.from("app_settings").select("*").limit(1);
  const t4 = await supabase.from("config").select("*").limit(1);
  console.log("t1 settings:", t1.error?.message ?? "Exists!");
  console.log("t2 follow_up_settings:", t2.error?.message ?? "Exists!");
  console.log("t3 app_settings:", t3.error?.message ?? "Exists!");
  console.log("t4 config:", t4.error?.message ?? "Exists!");
}

check();
