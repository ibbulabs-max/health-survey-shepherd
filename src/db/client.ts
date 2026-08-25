import { createClient } from "@supabase/supabase-js";

import { databaseConfig } from "@/config/database";

/**
 * Single browser Supabase client for the whole app (user session, RLS applies).
 * Configuration comes from src/config/database.ts only.
 */
export const supabase = createClient(databaseConfig.url, databaseConfig.publishableKey, {
  auth: {
    storageKey: databaseConfig.authStorageKey,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** Normalises a Supabase error into a user-safe message (details go to console). */
export function toUserMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!error) return fallback;
  console.error(error);
  const message = (error as { message?: string }).message ?? "";
  if (/JWT|token|session/i.test(message)) return "Your session expired. Please sign in again.";
  if (/row-level security|permission/i.test(message))
    return "You don't have permission to do that.";
  if (/duplicate key/i.test(message)) return "That record already exists.";
  if (/Failed to fetch|NetworkError/i.test(message))
    return "Network problem. Check your connection and try again.";
  if (/Invalid login credentials/i.test(message)) return "Incorrect User ID or PIN.";
  return message || fallback;
}
