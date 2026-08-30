import { createClient } from "@supabase/supabase-js";
import { databaseConfig } from "@/config/database";

/**
 * Initializes a Supabase client using the SERVICE ROLE KEY.
 * This client bypasses Row Level Security (RLS) entirely.
 *
 * NEVER import this file into a React component or any client-side bundle.
 * Only import this in TanStack Start `createServerFn` handlers.
 *
 * Env resolution order (deployment platforms expose different names):
 *   key: APP_SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SERVICE_ROLE_KEY
 *   url: APP_SUPABASE_URL | SUPABASE_URL | VITE_SUPABASE_URL | databaseConfig.url
 */
export function getSupabaseAdmin() {
  const serviceRoleKey =
    process.env["APP_SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const supabaseUrl =
    process.env["APP_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    process.env["VITE_SUPABASE_URL"] ||
    databaseConfig.url;

  if (!serviceRoleKey) {
    throw new Error(
      "Supabase service role key is not defined in the server environment (expected APP_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  if (!supabaseUrl) {
    throw new Error("Supabase URL is not defined in the server environment.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // New-format `sb_secret_*` keys are opaque, not JWTs. PostgREST rejects them
      // when sent as an Authorization bearer ("Expected 3 parts in JWT; got 1"),
      // so send them via the `apikey` header only.
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (
          serviceRoleKey.startsWith("sb_") &&
          headers.get("Authorization") === `Bearer ${serviceRoleKey}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", serviceRoleKey);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
