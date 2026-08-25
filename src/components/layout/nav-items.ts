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

import type { Permission } from "@/config/roles";

export interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  /** Shown in the mobile bottom bar (max 5). */
  primary?: boolean;
  permission?: Permission;
}

export const navItems: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home, primary: true },
  { to: "/houses", label: "Houses", icon: Users, primary: true },
  { to: "/map", label: "Map", icon: Map, primary: true },
  { to: "/followups", label: "Follow-ups", icon: CalendarCheck, primary: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3, primary: true },
  { to: "/import", label: "Smart Import", icon: Upload, permission: "import_data" },
  { to: "/quality", label: "Data Quality", icon: Sparkles },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/users", label: "Users", icon: ShieldCheck, permission: "manage_users" },
  { to: "/activity", label: "Activity", icon: Activity, permission: "view_audit_log" },
  { to: "/settings", label: "Settings", icon: Settings },
];
