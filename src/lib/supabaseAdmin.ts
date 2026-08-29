import { createClient } from "@supabase/supabase-js";
import { databaseConfig } from "@/config/database";

/**
 * Initializes a Supabase client using the SERVICE ROLE KEY.
 * This client bypasses Row Level Security (RLS) entirely.
 * 
 * NEVER import this file into a React component or any client-side bundle.
 * Only import this in TanStack Start `createServerFn` handlers.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined in the server environment.");
  }

  return createClient(databaseConfig.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
