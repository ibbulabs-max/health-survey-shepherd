/**
 * Centralised Supabase / database configuration.
 *
 * This is the ONLY place in the app that reads Supabase environment values.
 * Moving to a different Supabase project = change .env (or the deployment
 * environment variables) and run the SQL migrations. No component changes.
 */

const env: Record<string, string | undefined> =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};

export const databaseConfig = {
  url: env["VITE_SUPABASE_URL"] ?? "",
  publishableKey: env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "",
  /** Storage key for the persisted browser session. */
  authStorageKey: "management-app-auth",
  /**
   * Login uses "User ID + 6-digit PIN". Supabase Auth stores an email +
   * password, so a User ID is mapped to a deterministic internal address.
   * Changing this domain changes it everywhere.
   */
  identityDomain: "ibbulabs.app",
} as const;

export const userIdToAuthEmail = (userId: string) =>
  `${userId.trim().toLowerCase()}@${databaseConfig.identityDomain}`;

export const authEmailToUserId = (email: string | null | undefined) =>
  (email ?? "").split("@")[0] ?? "";

/** Table names in one place so a rename is a single-line change. */
export const tables = {
  profiles: "profiles",
  userRoles: "user_roles",
  teamMemberships: "team_memberships",
  houses: "houses",
  houseMembers: "house_members",
  memberAssessments: "member_assessments",
  followUps: "follow_ups",
  tasks: "tasks",
  pins: "pins",
  importBatches: "import_batches",
  importConflicts: "import_conflicts",
  activityLogs: "activity_logs",
  healthThresholdSettings: "health_threshold_settings",
  holidays: "holidays",
} as const;
