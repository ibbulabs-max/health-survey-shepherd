import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/db/client";

export type DashboardWidget = {
  id: string;
  group_id: string;
  widget_type: string;
  position_order: number;
  width: number;
  height: number;
  config: Record<string, any>;
};

export type DashboardGroup = {
  id: string;
  dashboard_id: string;
  name: string;
  position_order: number;
  widgets: DashboardWidget[];
};

export type AnalyticsDashboard = {
  id: string;
  name: string;
  user_id: string | null;
  role_default: string | null;
  groups: DashboardGroup[];
};

// Fetch a single dashboard with all nested groups and widgets
export function useAnalyticsDashboard(dashboardId?: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["analytics-dashboard", dashboardId],
    queryFn: async (): Promise<AnalyticsDashboard | null> => {
      // If no ID provided, try to find the user's default dashboard or the system default
      let targetId = dashboardId;

      if (!targetId) {
        // Try to get default dashboard for current user's role
        const { data: userSession } = await supabase.auth.getSession();
        const userId = userSession?.session?.user?.id;

        let role = "survey_user";
        if (userId) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .single();
          if (roleData) {
            role = roleData.role;
          }
        }

        // Search for dashboard: 1. Owned by user, 2. Role default, 3. Master admin default
        const { data: dashboards, error: dashError } = await supabase
          .from("analytics_dashboards")
          .select("*")
          .or(`user_id.eq.${userId},role_default.eq.${role},role_default.eq.master_admin`)
          .order("created_at", { ascending: false })
          .limit(1);

        if (dashError) throw dashError;
        
        if (dashboards && dashboards.length > 0) {
          targetId = dashboards[0].id;
        } else {
          return null; // No dashboard found
        }
      }

      // Fetch dashboard details
      const { data: dashboard, error: dError } = await supabase
        .from("analytics_dashboards")
        .select("*")
        .eq("id", targetId!)
        .single();

      if (dError) throw dError;

      // Fetch groups
      const { data: groups, error: gError } = await supabase
        .from("analytics_dashboard_groups")
        .select("*")
        .eq("dashboard_id", targetId!)
        .order("position_order", { ascending: true });

      if (gError) throw gError;

      // Fetch widgets for all groups
      const groupIds = groups.map((g) => g.id);
      let widgets: any[] = [];
      
      if (groupIds.length > 0) {
        const { data: wData, error: wError } = await supabase
          .from("analytics_dashboard_widgets")
          .select("*")
          .in("group_id", groupIds)
          .order("position_order", { ascending: true });

        if (wError) throw wError;
        widgets = wData || [];
      }

      // Construct nested tree
      const nestedGroups = groups.map((g) => ({
        ...g,
        widgets: widgets.filter((w) => w.group_id === g.id),
      }));

      return {
        ...dashboard,
        groups: nestedGroups,
      };
    },
    enabled: true, // Always run, will try to find default if dashboardId is undefined
  });
}

// Mutations for layout saving
export function useSaveDashboardLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dashboard: AnalyticsDashboard) => {
      // 1. Save group order
      for (const group of dashboard.groups) {
        await supabase
          .from("analytics_dashboard_groups")
          .update({ position_order: group.position_order, name: group.name })
          .eq("id", group.id);
        
        // 2. Save widget order and config
        for (const widget of group.widgets) {
          await supabase
            .from("analytics_dashboard_widgets")
            .update({ 
              position_order: widget.position_order, 
              group_id: group.id, // In case it moved groups
              width: widget.width,
              height: widget.height,
              config: widget.config
            })
            .eq("id", widget.id);
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard", undefined] });
    },
  });
}

export function useAddDashboardGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ dashboardId, name, order }: { dashboardId: string; name: string; order: number }) => {
      const { data, error } = await supabase
        .from("analytics_dashboard_groups")
        .insert({
          dashboard_id: dashboardId,
          name,
          position_order: order
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    }
  });
}

export function useAddDashboardWidget() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      groupId, widgetType, order, width = 1, height = 1, config = {} 
    }: { 
      groupId: string; widgetType: string; order: number; width?: number; height?: number; config?: any;
    }) => {
      const { data, error } = await supabase
        .from("analytics_dashboard_widgets")
        .insert({
          group_id: groupId,
          widget_type: widgetType,
          position_order: order,
          width,
          height,
          config
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    }
  });
}

export function useCreateDashboard() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ name, userId, roleDefault }: { name: string; userId?: string; roleDefault?: string }) => {
      const { data, error } = await supabase
        .from("analytics_dashboards")
        .insert({
          name,
          user_id: userId || null,
          role_default: roleDefault || null
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-dashboard"] });
    }
  });
}