import React, { useState } from "react";
import { Plus, GripVertical, ChevronUp, ChevronDown, Settings2, Trash2 } from "lucide-react";
import { WidgetFactory } from "./WidgetFactory";
import type { AnalyticsDashboard, DashboardGroup, DashboardWidget } from "@/hooks/useAnalyticsDashboard";
import { useSaveDashboardLayout, useAddDashboardGroup, useAddDashboardWidget } from "@/hooks/useAnalyticsDashboard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DashboardEngineProps {
  dashboard: AnalyticsDashboard;
  analyticsData: any;
  filters: any;
  isEditMode: boolean;
  handleCandleClick: (key: string, val: string | number) => void;
  isCandleActive: (key: string, val: string | number) => boolean;
}

const AVAILABLE_WIDGETS = [
  { type: "candle_gender", label: "Gender Distribution" },
  { type: "candle_age", label: "Age Distribution" },
  { type: "candle_blood_sugar", label: "Blood Sugar" },
  { type: "candle_bp_sys", label: "Systolic BP" },
  { type: "candle_bp_dia", label: "Diastolic BP" },
  { type: "candle_bmi", label: "BMI Categories" },
];

export function DashboardEngine({
  dashboard,
  analyticsData,
  filters,
  isEditMode,
  handleCandleClick,
  isCandleActive
}: DashboardEngineProps) {
  // Local state for optimistic UI updates during edit mode
  const [localDashboard, setLocalDashboard] = useState<AnalyticsDashboard>(dashboard);
  const saveLayout = useSaveDashboardLayout();
  const addGroup = useAddDashboardGroup();
  const addWidget = useAddDashboardWidget();

  // Sync local state when dashboard prop changes (from DB)
  React.useEffect(() => {
    setLocalDashboard(dashboard);
  }, [dashboard]);

  const handleSave = async () => {
    try {
      await saveLayout.mutateAsync(localDashboard);
      toast.success("Dashboard layout saved!");
    } catch (e: any) {
      toast.error(e.message || "Failed to save layout");
    }
  };

  const handleAddGroup = async () => {
    const name = window.prompt("Enter new group name:", "New Group");
    if (!name) return;
    try {
      const order = localDashboard.groups.length;
      await addGroup.mutateAsync({ dashboardId: dashboard.id, name, order });
      toast.success("Group added");
    } catch (e: any) {
      toast.error("Failed to add group");
    }
  };

  const handleAddWidget = async (groupId: string) => {
    const typeStr = window.prompt(
      "Enter widget type:\n" + AVAILABLE_WIDGETS.map((w, i) => `${i + 1}. ${w.label}`).join("\n"),
      "1"
    );
    if (!typeStr) return;
    
    const idx = parseInt(typeStr) - 1;
    const widgetType = AVAILABLE_WIDGETS[idx]?.type;
    if (!widgetType) {
      toast.error("Invalid widget selection");
      return;
    }

    const group = localDashboard.groups.find(g => g.id === groupId);
    const order = group ? group.widgets.length : 0;

    try {
      await addWidget.mutateAsync({ groupId, widgetType, order });
      toast.success("Widget added");
    } catch (e: any) {
      toast.error("Failed to add widget");
    }
  };

  const moveGroup = (idx: number, dir: -1 | 1) => {
    if (idx + dir < 0 || idx + dir >= localDashboard.groups.length) return;
    const newGroups = [...localDashboard.groups];
    const temp = newGroups[idx];
    newGroups[idx] = newGroups[idx + dir] as DashboardGroup;
    newGroups[idx + dir] = temp as DashboardGroup;
    
    // Update order values
    newGroups.forEach((g, i) => { g.position_order = i; });
    
    setLocalDashboard({ ...localDashboard, groups: newGroups });
  };

  const moveWidget = (groupIndex: number, widgetIndex: number, dir: -1 | 1) => {
    const group = localDashboard.groups[groupIndex];
    if (!group || widgetIndex + dir < 0 || widgetIndex + dir >= group.widgets.length) return;
    
    const newGroups = [...localDashboard.groups];
    const newWidgets = [...group.widgets];
    
    const temp = newWidgets[widgetIndex];
    newWidgets[widgetIndex] = newWidgets[widgetIndex + dir] as DashboardWidget;
    newWidgets[widgetIndex + dir] = temp as DashboardWidget;
    
    // Update order values
    newWidgets.forEach((w, i) => { w.position_order = i; });
    newGroups[groupIndex] = { ...group, widgets: newWidgets } as DashboardGroup;
    
    setLocalDashboard({ ...localDashboard, groups: newGroups });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
      {isEditMode && (
        <div className="sticky top-20 z-40 bg-surface border border-primary/30 p-3 rounded-2xl shadow-xl flex items-center justify-between mb-6">
          <div>
            <p className="font-semibold text-sm text-foreground">Edit Layout Mode: {localDashboard.name}</p>
            <p className="text-xs text-muted-foreground">Make changes to groups and widgets, then save.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleAddGroup} className="h-8 rounded-xl text-xs">
              <Plus className="size-3.5 mr-1" /> Add Group
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveLayout.isPending} className="h-8 rounded-xl text-xs bg-primary font-semibold">
              Save Layout
            </Button>
          </div>
        </div>
      )}

      {localDashboard.groups.map((group, groupIdx) => (
        <div 
          key={group.id} 
          className={cn(
            "space-y-4",
            isEditMode && "p-4 rounded-3xl border-2 border-dashed border-border/60 bg-surface/30"
          )}
        >
          {/* Group Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEditMode && (
                <div className="flex flex-col gap-0 mr-2">
                  <button onClick={() => moveGroup(groupIdx, -1)} className="hover:text-primary p-0.5 text-muted-foreground transition-colors"><ChevronUp className="size-4" /></button>
                  <button onClick={() => moveGroup(groupIdx, 1)} className="hover:text-primary p-0.5 text-muted-foreground transition-colors"><ChevronDown className="size-4" /></button>
                </div>
              )}
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {group.name}
              </h2>
            </div>
            
            {isEditMode && (
              <Button size="sm" variant="ghost" onClick={() => handleAddWidget(group.id)} className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg">
                <Plus className="size-3.5 mr-1" /> Add Widget
              </Button>
            )}
          </div>

          {/* Group Widgets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {group.widgets.map((widget, widgetIdx) => (
              <div 
                key={widget.id} 
                className={cn(
                  "relative group",
                  widget.width > 1 && `md:col-span-${widget.width}`
                )}
              >
                {isEditMode && (
                  <div className="absolute -top-3 -right-3 z-20 flex bg-surface border border-border shadow-md rounded-xl p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveWidget(groupIdx, widgetIdx, -1)} className="p-1 hover:bg-surface-muted rounded-md text-muted-foreground"><ChevronUp className="size-3.5" /></button>
                    <button onClick={() => moveWidget(groupIdx, widgetIdx, 1)} className="p-1 hover:bg-surface-muted rounded-md text-muted-foreground"><ChevronDown className="size-3.5" /></button>
                  </div>
                )}
                
                <WidgetFactory 
                  widget={widget} 
                  analyticsData={analyticsData} 
                  filters={filters}
                  isCandleActive={isCandleActive}
                  handleCandleClick={handleCandleClick}
                />
              </div>
            ))}
            
            {group.widgets.length === 0 && isEditMode && (
              <div className="md:col-span-2 lg:col-span-3 border-2 border-dashed border-border/40 rounded-2xl p-8 text-center text-muted-foreground text-xs flex flex-col items-center justify-center">
                <p>Empty Group</p>
                <Button variant="outline" size="sm" onClick={() => handleAddWidget(group.id)} className="mt-3 rounded-xl h-8">
                  Add Widget
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {localDashboard.groups.length === 0 && !isEditMode && (
        <div className="text-center py-20 text-muted-foreground">
          No dashboard configuration found.
        </div>
      )}
    </div>
  );
}
