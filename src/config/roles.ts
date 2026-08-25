/**
 * Roles come from the existing `public.app_role` enum in the database:
 *   admin | super_admin | supervisor | survey_user
 * "CSW / CHW" in the product spec maps to the existing `survey_user` value.
 * Roles are ALWAYS read from the database (user_roles), never from the client.
 */
export const APP_ROLES = ["super_admin", "admin", "supervisor", "survey_user"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  supervisor: "Supervisor",
  survey_user: "CSW / CHW",
};

export const isAdminLike = (role: AppRole | null) =>
  role === "admin" || role === "super_admin";

export type Permission =
  | "manage_users"
  | "manage_settings"
  | "import_data"
  | "resolve_conflicts"
  | "view_all_data"
  | "view_team_data"
  | "complete_followups"
  | "view_audit_log";

const permissionsByRole: Record<AppRole, Permission[]> = {
  super_admin: [
    "manage_users",
    "manage_settings",
    "import_data",
    "resolve_conflicts",
    "view_all_data",
    "view_team_data",
    "complete_followups",
    "view_audit_log",
  ],
  admin: [
    "manage_users",
    "manage_settings",
    "import_data",
    "resolve_conflicts",
    "view_all_data",
    "view_team_data",
    "complete_followups",
    "view_audit_log",
  ],
  supervisor: ["view_team_data", "resolve_conflicts", "import_data", "complete_followups"],
  survey_user: ["complete_followups"],
};

export const roleHasPermission = (role: AppRole | null, permission: Permission) =>
  !!role && permissionsByRole[role].includes(permission);
