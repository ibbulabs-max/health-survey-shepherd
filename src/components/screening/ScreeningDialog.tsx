import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RiskBadge } from "@/components/common/RiskBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { importConfig } from "@/config/importing";
import { useRefreshDataset } from "@/hooks/useDataset";
import { calculateRisk, type MemberView } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { saveScreening } from "@/services/screeningService";

export function ScreeningDialog({
  member,
  houseUuid,
  open,
  onOpenChange,
}: {
  member: MemberView;
  houseUuid: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const refresh = useRefreshDataset();
  const [available, setAvailable] = useState(true);
  const [systolic, setSystolic] = useState(member.systolic?.toString() ?? "");
  const [diastolic, setDiastolic] = useState(member.diastolic?.toString() ?? "");
  const [sugar, setSugar] = useState(member.bloodSugar?.toString() ?? "");
  const [height, setHeight] = useState(member.assessment?.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState(member.assessment?.weight_kg?.toString() ?? "");
  const [conditions, setConditions] = useState<string[]>(member.conditions);
  const [medication, setMedication] = useState("");
  const [notes, setNotes] = useState("");
  const [referral, setReferral] = useState(false);

  const preview = calculateRisk({
    systolic: Number(systolic) || null,
    diastolic: Number(diastolic) || null,
    bloodSugar: Number(sugar) || null,
    conditions,
  });

  const mutation = useMutation({
    mutationFn: () =>
      saveScreening({
        houseUuid,
        memberUuid: member.id,
        available,
        systolic: Number(systolic) || null,
        diastolic: Number(diastolic) || null,
        bloodSugar: Number(sugar) || null,
        heightCm: Number(height) || null,
        weightKg: Number(weight) || null,
        waist: null,
        knownHistory: conditions,
        medication: medication
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
        smoking: null,
        alcohol: null,
        tobacco: null,
        physicalActivity: null,
        notes: notes || null,
        referralNeeded: referral,
      }),
    onSuccess: () => {
      toast.success("Screening saved and next follow-up scheduled.");
      void refresh();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save screening."),
  });

  const toggleCondition = (condition: string) =>
    setConditions((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition],
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Screen {member.name}</DialogTitle>
          <DialogDescription>
            Exact readings are stored as entered. Risk is derived, never a replacement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium">Member available</p>
              <p className="text-xs text-muted-foreground">Turn off to record a missed visit</p>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Systolic" value={systolic} onChange={setSystolic} unit="mmHg" />
            <Field label="Diastolic" value={diastolic} onChange={setDiastolic} unit="mmHg" />
            <Field label="Blood sugar" value={sugar} onChange={setSugar} unit="mg/dL" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Height" value={height} onChange={setHeight} unit="cm" />
            <Field label="Weight" value={weight} onChange={setWeight} unit="kg" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Known conditions</Label>
            <div className="flex flex-wrap gap-2">
              {importConfig.conditionVocabulary.map((condition) => (
                <button
                  key={condition}
                  type="button"
                  onClick={() => toggleCondition(condition)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    conditions.includes(condition)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {condition}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="medication" className="text-sm">
              Medication (comma separated)
            </Label>
            <Input
              id="medication"
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
            <p className="text-sm font-medium">Referral needed</p>
            <Switch checked={referral} onCheckedChange={setReferral} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">Derived risk</p>
              <p className="text-xs text-muted-foreground">
                {preview.reasons.length ? preview.reasons.join(" • ") : "No risk factors detected"}
              </p>
            </div>
            <RiskBadge level={preview.level} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="secondary" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save screening"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label} <span className="font-normal">({unit})</span>
      </Label>
      <Input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl text-center tabular-nums"
      />
    </div>
  );
}
