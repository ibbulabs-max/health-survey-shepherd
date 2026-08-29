import {
  Activity,
  BarChart3,
  CalendarCheck,
  Home,
  Map,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  FileText,
  Settings,
} from "lucide-react";

import type { Permission, AppRole } from "@/config/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  /** Shown in the mobile bottom bar (max 5). */
  primary?: boolean;
  permission?: Permission;
  roles?: AppRole[];
}

export const navItems: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/houses", label: "Houses", icon: Users },
  { to: "/map", label: "Map", icon: Map },
  { to: "/followups", label: "Follow-ups", icon: CalendarCheck },
  { to: "/assessments", label: "Assessments", icon: Activity, roles: ["survey_user"] },
  { to: "/team", label: "Team", icon: Users, roles: ["supervisor"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/import", label: "Smart Import", icon: Upload, permission: "import_data" },
  { to: "/quality", label: "Data Quality", icon: Sparkles },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/users", label: "Users", icon: ShieldCheck, permission: "manage_users" },
  { to: "/settings", label: "Settings", icon: Settings },
];
