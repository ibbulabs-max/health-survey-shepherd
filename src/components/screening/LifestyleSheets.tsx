import { useState } from "react";
import { Info, Check, Sparkles } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface LifestyleFrequencySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  value: string;
  onSelect: (frequency: string) => void;
}

const FREQUENCY_OPTIONS = [
  { id: "Occasionally", label: "Occasionally", desc: "Less than once a week" },
  { id: "1-2 times/week", label: "1–2 times / week", desc: "Light weekly intake" },
  { id: "3-5 times/week", label: "3–5 times / week", desc: "Moderate frequent intake" },
  { id: "Daily", label: "Daily", desc: "Heavy / regular daily consumption" },
  { id: "Other", label: "Other / Variable", desc: "Irregular pattern" },
];

export function LifestyleFrequencySheet({
  open,
  onOpenChange,
  title,
  subtitle,
  value,
  onSelect,
}: LifestyleFrequencySheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mt-3 mb-1" />
        <DrawerHeader className="text-left px-6">
          <DrawerTitle className="font-display text-lg font-bold">{title}</DrawerTitle>
          {subtitle && <DrawerDescription className="text-xs">{subtitle}</DrawerDescription>}
        </DrawerHeader>

        <div className="px-6 py-2 space-y-2">
          {FREQUENCY_OPTIONS.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all",
                  active
                    ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                    : "bg-surface text-foreground border-border/70 hover:bg-surface-muted"
                )}
              >
                <div>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                </div>
                {active && <Check className="size-4 text-primary stroke-[3]" />}
              </button>
            );
          })}
        </div>

        <DrawerFooter className="px-6 pb-8 pt-4">
          <DrawerClose asChild>
            <Button variant="ghost" className="w-full rounded-xl">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export interface FamilyHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedConditions: string[];
  onChange: (conditions: string[]) => void;
}

const FAMILY_CONDITIONS = [
  "Diabetes",
  "Hypertension",
  "Heart Disease",
  "Stroke",
  "COPD / Asthma",
  "Thyroid Disorder",
  "Kidney Disease",
  "Cancer",
  "Other Hereditary Condition",
];

export function FamilyHistorySheet({
  open,
  onOpenChange,
  selectedConditions,
  onChange,
}: FamilyHistorySheetProps) {
  const toggle = (cond: string) => {
    if (selectedConditions.includes(cond)) {
      onChange(selectedConditions.filter((c) => c !== cond));
    } else {
      onChange([...selectedConditions, cond]);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mt-3 mb-1" />
        <DrawerHeader className="text-left px-6">
          <DrawerTitle className="font-display text-lg font-bold">Family Medical History</DrawerTitle>
          <DrawerDescription className="text-xs">
            Select conditions present in first-degree relatives (Parents, Siblings).
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 py-2 grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
          {FAMILY_CONDITIONS.map((cond) => {
            const active = selectedConditions.includes(cond);
            return (
              <button
                key={cond}
                type="button"
                onClick={() => toggle(cond)}
                className={cn(
                  "p-3 rounded-2xl border text-left text-xs font-semibold flex items-center justify-between transition-all",
                  active
                    ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                    : "bg-surface text-foreground border-border/70 hover:bg-surface-muted"
                )}
              >
                <span className="truncate">{cond}</span>
                {active && <Check className="size-3.5 ml-1 text-primary shrink-0 stroke-[3]" />}
              </button>
            );
          })}
        </div>

        <DrawerFooter className="px-6 pb-8 pt-4">
          <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl font-semibold">
            Done ({selectedConditions.length} selected)
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Translucent Dark iOS-style Pill Button for BP and Sugar Risk Factors
 */
export function RiskFactorsSheetButton({
  title,
  type,
  currentValue,
}: {
  title: string;
  type: "bp" | "sugar";
  currentValue?: string | number | null;
}) {
  const [open, setOpen] = useState(false);

  const bpQuestions = [
    "Known history of hypertension / elevated BP in past screenings",
    "Currently taking prescribed anti-hypertensive tablets",
    "Symptoms: Occasional severe headache, blurred vision, or chest tightness",
    "High dietary salt consumption or high sodium intake",
    "Family history of premature cardiovascular disease or stroke",
  ];

  const sugarQuestions = [
    "Known history of Diabetes Mellitus / Gestational Diabetes",
    "Currently taking oral hypoglycemic drugs or insulin",
    "Symptoms: Excessive thirst (polydipsia), frequent night urination (polyuria), unexplained weight loss",
    "Sedentary lifestyle with minimal physical activity",
    "Family history of Diabetes in parents or siblings",
  ];

  const questions = type === "bp" ? bpQuestions : sugarQuestions;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-neutral-900/85 hover:bg-neutral-900 text-white backdrop-blur-md border border-white/20 shadow-xs transition-all active:scale-95"
      >
        <Sparkles className="size-3 text-amber-300" />
        <span>{title}</span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-w-md mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-xl">
          <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mt-3 mb-1" />
          <DrawerHeader className="text-left px-6">
            <DrawerTitle className="font-display text-lg font-bold">{title}</DrawerTitle>
            <DrawerDescription className="text-xs">
              Clinical guidance & risk factor indicators for {type === "bp" ? "Blood Pressure" : "Blood Sugar"}.
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-6 py-2 space-y-2.5 max-h-[50vh] overflow-y-auto">
            {currentValue && (
              <div className="p-3 bg-surface-muted rounded-xl border border-border/50 text-xs flex justify-between items-center font-mono">
                <span className="text-muted-foreground">Current Reading:</span>
                <span className="font-bold text-foreground">{currentValue}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Clinical Risk Questions:
              </span>
              {questions.map((q, i) => (
                <div
                  key={i}
                  className="p-3 bg-surface rounded-xl border border-border/70 text-xs text-foreground flex items-start gap-2.5"
                >
                  <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{q}</span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-primary-soft/30 border border-primary/20 rounded-xl text-[11px] text-muted-foreground">
              Clinical rules are dynamically applied during assessment submission to derive the final risk tier.
            </div>
          </div>

          <DrawerFooter className="px-6 pb-8 pt-3">
            <DrawerClose asChild>
              <Button className="w-full rounded-xl font-semibold">Got it</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
