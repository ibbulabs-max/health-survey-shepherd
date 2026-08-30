import { supabase } from "@/db/client";
import { tables } from "@/config/database";

export interface Holiday {
  id: string;
  holiday_date: string;
  name: string | null;
  created_by: string | null;
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await supabase
    .from(tables.holidays)
    .select("*")
    .order("holiday_date", { ascending: true });

  if (error) {
    // Log a concise informational message — the holidays table may be optional
    // for deployments that haven't applied migrations yet. Returning an empty
    // list keeps follow-up scheduling functional without breaking the UI.
    console.info("fetchHolidays: holidays table unavailable or not migrated yet.", error.message);
    return [];
  }
  return data as Holiday[];
}

export async function createHoliday(date: string, name: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from(tables.holidays)
    .insert({
      holiday_date: date,
      name: name || null,
      created_by: auth.user?.id || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Holiday;
}

export async function deleteHoliday(id: string) {
  const { error } = await supabase.from(tables.holidays).delete().eq("id", id);
  if (error) throw error;
}
