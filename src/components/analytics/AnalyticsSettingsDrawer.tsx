import React, { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw, Save } from "lucide-react";
import type { JsonObject } from "@/db/types";

export interface AnalyticsPreferences {
  showAge: boolean;
  showGender: boolean;
  showRisk: boolean;
  showBP: boolean;
  showSugar: boolean;
  showBMI: boolean;
  showConditions: boolean;
  showLifestyle: boolean;
  showClinicalRisk: boolean;
  showFollowUp: boolean;
  showReferral: boolean;
  showAssessment: boolean;
  showTrends: boolean;
}

export const defaultPreferences: AnalyticsPreferences = {
  showAge: true,
  showGender: true,
  showRisk: true,
  showBP: true,
  showSugar: true,
  showBMI: true,
  showConditions: true,
  showLifestyle: true,
  showClinicalRisk: true,
  showFollowUp: true,
  showReferral: true,
  showAssessment: true,
  showTrends: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPreferences: JsonObject | null;
  onSave: (prefs: AnalyticsPreferences) => Promise<void>;
}

export function AnalyticsSettingsDrawer({ open, onOpenChange, initialPreferences, onSave }: Props) {
  const [preferences, setPreferences] = useState<AnalyticsPreferences>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialPreferences && Object.keys(initialPreferences).length > 0) {
        setPreferences({
          ...defaultPreferences,
          ...(initialPreferences as unknown as AnalyticsPreferences),
        });
      } else {
        setPreferences(defaultPreferences);
      }
    }
  }, [open, initialPreferences]);

  const handleToggle = (key: keyof AnalyticsPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setPreferences(defaultPreferences);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(preferences);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const options: { key: keyof AnalyticsPreferences; label: string }[] = [
    { key: "showAge", label: "Age Analytics" },
    { key: "showGender", label: "Gender Analytics" },
    { key: "showRisk", label: "Risk Analytics" },
    { key: "showBP", label: "BP Analytics" },
    { key: "showSugar", label: "Sugar Analytics" },
    { key: "showBMI", label: "BMI Analytics" },
    { key: "showConditions", label: "Known Conditions" },
    { key: "showLifestyle", label: "Lifestyle Analytics" },
    { key: "showClinicalRisk", label: "Clinical Risk Level" },
    { key: "showFollowUp", label: "Follow-up Status" },
    { key: "showReferral", label: "Referral Status" },
    { key: "showAssessment", label: "Assessment Status" },
    { key: "showTrends", label: "Monthly Trends" },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] p-4 rounded-t-3xl bg-background/95 backdrop-blur-2xl">
        <DrawerHeader className="p-0 pb-3 flex items-center justify-between">
          <DrawerTitle className="text-base font-bold">Customize Analytics</DrawerTitle>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </button>
        </DrawerHeader>
        <div className="overflow-y-auto max-h-[60vh] space-y-4 px-1 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {options.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between bg-surface p-3 rounded-xl border border-border/50"
              >
                <Label htmlFor={`toggle-${key}`} className="text-sm cursor-pointer">
                  {label}
                </Label>
                <Switch
                  id={`toggle-${key}`}
                  checked={preferences[key]}
                  onCheckedChange={() => handleToggle(key)}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="pt-4 mt-2 border-t border-border/40">
          <Button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="w-full h-12 rounded-xl"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
