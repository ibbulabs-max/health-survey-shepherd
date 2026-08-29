import { supabase } from "@/db/client";

export interface Holiday {
  id: string;
  holiday_date: string;
  name: string | null;
  created_by: string | null;
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .order("holiday_date", { ascending: true });
    
  if (error) {
    console.warn("Holidays table might not exist yet:", error.message);
    return [];
  }
  return data as Holiday[];
}

export async function createHoliday(date: string, name: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("holidays")
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
  const { error } = await supabase
    .from("holidays")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
