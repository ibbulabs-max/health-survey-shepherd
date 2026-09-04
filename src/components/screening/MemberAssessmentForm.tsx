import { useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Save,
  CheckCircle2,
  Stethoscope,
  Heart,
  Activity,
  AlertTriangle,
  UserCheck,
  Building2,
  ArrowRight,
  Sparkles,
  History,
  Calendar,
  Clock,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/db/client";
import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { saveScreening } from "@/services/screeningService";
import { calculateRisk } from "@/lib/domain";
import { getReferralDestinations } from "@/config/referrals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  LifestyleFrequencySheet,
  FamilyHistorySheet,
  RiskFactorsSheetButton,
} from "@/components/screening/LifestyleSheets";
import { cn } from "@/lib/utils";

export function MemberAssessmentForm({
  memberId,
  houseUuid,
  onComplete,
  onCancel,
}: {
  memberId: string;
  houseUuid?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const navigate = useNavigate();
  const { data, isLoading } = useDataset();
  const refresh = useRefreshDataset();
  const { role } = useAuth();
  const isCHW = role === "survey_user" || role === "admin" || role === "super_admin";

  const member = data?.members.find((m) => m.id === memberId);
  const house = data?.houses.find((h) => h.house.id === member?.houseUuid);

  // Step state
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Assessment Completed State for Next Member Flow
  const [isCompleted, setIsCompleted] = useState(false);

  // Form State
  const [available, setAvailable] = useState(true);
  const [knownHistoryStatus, setKnownHistoryStatus] = useState<"none" | "known">("none");
  const [conditions, setConditions] = useState<string[]>([]);
  const [htnMedication, setHtnMedication] = useState("");
  const [dmMedication, setDmMedication] = useState("");
  const [medicationNotes, setMedicationNotes] = useState("");

  // Lifestyle State
  const [alcohol, setAlcohol] = useState<string>("No");
  const [alcoholFreq, setAlcoholFreq] = useState<string>("");
  const [alcoholSheetOpen, setAlcoholSheetOpen] = useState(false);

  const [smoking, setSmoking] = useState<string>("No");
  const [smokingFreq, setSmokingFreq] = useState<string>("");
  const [smokingSheetOpen, setSmokingSheetOpen] = useState(false);

  const [tobacco, setTobacco] = useState<string>("No");
  const [tobaccoFreq, setTobaccoFreq] = useState<string>("");
  const [tobaccoSheetOpen, setTobaccoSheetOpen] = useState(false);

  const [waistCm, setWaistCm] = useState<string>("");
  const [physicalActivity, setPhysicalActivity] = useState<string>(">=150");

  const [familyHistory, setFamilyHistory] = useState<"No" | "Yes">("No");
  const [familyConditions, setFamilyConditions] = useState<string[]>([]);
  const [familyHistorySheetOpen, setFamilyHistorySheetOpen] = useState(false);

  // Physical & Anthropometrics
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // Vitals
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [sugar, setSugar] = useState("");
  const [pulse, setPulse] = useState("");
  const [temperature, setTemperature] = useState("");
  const [spo2, setSpo2] = useState("");

  // Referral & Notes
  const [referralNeeded, setReferralNeeded] = useState(false);
  const [referralDestinationId, setReferralDestinationId] = useState("dest_1");
  const [customDestination, setCustomDestination] = useState("");
  const [referralNotes, setReferralNotes] = useState("");
  const [screeningNotes, setScreeningNotes] = useState("");
  const [selectedClinicalRisk, setSelectedClinicalRisk] = useState<string>("");

  const referralDestinations = useMemo(() => {
    const staticDestinations = getReferralDestinations();
    
    // Add dynamic map hospitals
    const mapHospitals = data?.houses
      .filter((h) => h.house.pin_type === "hospital" && h.house.location_status === "mapped")
      .map((h) => ({
        id: `map_hospital_${h.house.id}`,
        name: h.house.owner_name || h.house.house_id || "Unnamed Map Hospital",
        type: "map_hospital",
        latitude: h.house.latitude,
        longitude: h.house.longitude,
        originalId: h.house.id,
      })) || [];

    return [...staticDestinations, ...mapHospitals];
  }, [data?.houses]);

  // History Sheet State
  const [historyOpen, setHistoryOpen] = useState(false);

  // Fetch Historical Data
  const { data: memberHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["member_history", memberId],
    queryFn: async () => {
      if (!memberId) return null;
      // Get all assessments for this member ordered by date
      const { data: assessments } = await supabase
        .from("member_assessments")
        .select("*")
        .eq("member_uuid", memberId)
        .order("assessed_at", { ascending: false });

      // Get all follow-ups for this member
      const { data: followUps } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("member_uuid", memberId)
        .order("created_at", { ascending: false });

      return {
        assessments: assessments || [],
        followUps: followUps || [],
      };
    },
    enabled: !!memberId && historyOpen,
  });

  // Initialize once loaded
  const [initialized, setInitialized] = useState(false);
  if (member && !initialized) {
    setSystolic(member.systolic?.toString() ?? "");
    setDiastolic(member.diastolic?.toString() ?? "");
    setSugar(member.bloodSugar?.toString() ?? "");
    setHeight(member.assessment?.height_cm?.toString() ?? "");
    setWeight(member.assessment?.weight_kg?.toString() ?? "");
    setAlcohol(member.assessment?.alcohol ?? "No");
    setAlcoholFreq(member.assessment?.alcohol_frequency ?? "");
    setSmoking(member.assessment?.smoking ?? "No");
    setSmokingFreq(member.assessment?.smoking_frequency ?? "");
    setTobacco(member.assessment?.tobacco ?? "No");
    setTobaccoFreq(member.assessment?.tobacco_frequency ?? "");
    setPhysicalActivity(member.assessment?.physical_activity ?? ">=150");
    setConditions(member.conditions);
    if (member.conditions.length > 0) {
      setKnownHistoryStatus("known");
    }
    setScreeningNotes(member.assessment?.notes ?? "");
    setReferralNeeded(member.assessment?.referral_needed ?? false);
    setAvailable(member.assessment?.available ?? true);
    setSelectedClinicalRisk(["low", "moderate", "high"].includes(member.risk) ? member.risk : "");
    setInitialized(true);
  }

  // BMI Calculation
  const bmiNum =
    height && weight && Number(height) > 0 && Number(weight) > 0
      ? Number((Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1))
      : null;

  const bmiCategory = useMemo(() => {
    if (!bmiNum) return null;
    if (bmiNum < 18.5) return { label: "Underweight (<18.5)", color: "text-blue-500" };
    if (bmiNum <= 22.9) return { label: "Normal (18.5–22.9)", color: "text-emerald-500" };
    if (bmiNum <= 24.9) return { label: "Overweight (23.0–24.9)", color: "text-amber-500" };
    if (bmiNum <= 29.9) return { label: "Pre-Obese (25.0–29.9)", color: "text-orange-500" };
    return { label: "Obese (≥30)", color: "text-rose-500" };
  }, [bmiNum]);

  // Lifestyle Score Calculation
  const lifestyleRiskScore = useMemo(() => {
    let score = 0;
    if (alcohol === "Yes" || alcoholFreq === "Daily") score += 2;
    if (smoking === "Yes" || smokingFreq === "Daily") score += 3;
    if (tobacco === "Yes" || tobaccoFreq === "Daily") score += 2;
    if (physicalActivity === "<150") score += 2;
    if (familyHistory === "Yes" && familyConditions.length > 0) score += 2;
    if (bmiNum && bmiNum >= 25) score += 2;
    if (Number(waistCm) >= 90) score += 2;
    return score;
  }, [
    alcohol,
    alcoholFreq,
    smoking,
    smokingFreq,
    tobacco,
    tobaccoFreq,
    physicalActivity,
    familyHistory,
    familyConditions,
    bmiNum,
    waistCm,
  ]);

  // Clinical Risk Calculation
  const riskResult = calculateRisk({
    systolic: Number(systolic) || null,
    diastolic: Number(diastolic) || null,
    bloodSugar: Number(sugar) || null,
    conditions: knownHistoryStatus === "known" ? conditions : [],
  });

  // Find next pending member in this household
  const otherPendingMembers = useMemo(() => {
    if (!house) return [];
    return house.members.filter((m) => m.id !== memberId && m.eligible && !m.screenedAt);
  }, [house, memberId]);

  const mutation = useMutation({
    mutationFn: async () => {
      const combinedMedications: string[] = [];
      if (htnMedication) combinedMedications.push(`HTN: ${htnMedication}`);
      if (dmMedication) combinedMedications.push(`DM: ${dmMedication}`);
      if (medicationNotes) combinedMedications.push(`Notes: ${medicationNotes}`);

      const selectedDest = referralDestinations.find((d) => d.id === referralDestinationId);
      const destinationName =
        referralDestinationId === "dest_other"
          ? customDestination
          : (selectedDest?.name ?? "Referred");

      return await saveScreening({
        houseUuid: member?.houseUuid ?? null,
        memberUuid: member!.id,
        available,
        systolic: Number(systolic) || null,
        diastolic: Number(diastolic) || null,
        bloodSugar: Number(sugar) || null,
        heightCm: Number(height) || null,
        weightKg: Number(weight) || null,
        waist: waistCm ? `${waistCm} cm` : null,
        knownHistory: knownHistoryStatus === "known" ? conditions : [],
        medication: combinedMedications,
        smoking: smoking !== "No" ? `${smoking} (${smokingFreq || "Regular"})` : "No",
        alcohol: alcohol !== "No" ? `${alcohol} (${alcoholFreq || "Regular"})` : "No",
        tobacco: tobacco !== "No" ? `${tobacco} (${tobaccoFreq || "Regular"})` : "No",
        physicalActivity,
        notes: [
          screeningNotes,
          familyHistory === "Yes" ? `Family History: ${familyConditions.join(", ")}` : null,
          pulse ? `Pulse: ${pulse} bpm` : null,
          temperature ? `Temp: ${temperature}°F` : null,
          spo2 ? `SpO2: ${spo2}%` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        referralNeeded,
        clinicalRisk: (selectedClinicalRisk as "low" | "moderate" | "high") || null,
        extra: referralNeeded
          ? {
              referral_destination: destinationName,
              referral_notes: referralNotes,
              lifestyle_score: lifestyleRiskScore,
              ...(selectedDest?.type === "map_hospital" ? {
                referral_hospital_id: selectedDest.originalId,
                referral_hospital_name: selectedDest.name,
                referral_hospital_lat: selectedDest.latitude,
                referral_hospital_lng: selectedDest.longitude,
              } : {})
            }
          : { lifestyle_score: lifestyleRiskScore },
      });
    },
    onSuccess: () => {
      toast.success(`Assessment saved for ${member?.name}!`);
      void refresh();
      setIsCompleted(true);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save assessment.");
    },
  });

  if (isLoading || !initialized) {
    return <div className="p-12 text-center text-muted-foreground">Loading assessment…</div>;
  }
  if (!member) {
    return (
      <div className="p-12 text-center text-destructive font-semibold">
        Member record not found.
      </div>
    );
  }

  const handleNext = () => setStep((s) => Math.min(totalSteps, s + 1));
  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  // COMPLETED SURVEY SUCCESS / NEXT MEMBER STATE
  if (isCompleted) {
    if (onComplete) {
      return (
        <div className="min-h-screen bg-background p-4 flex flex-col justify-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="card-surface p-8 rounded-3xl text-center space-y-4 shadow-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="size-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg animate-in zoom-in duration-500 delay-150">
              <CheckCircle2 className="size-10 stroke-[2.5]" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">Assessment Saved!</h2>
            <div className="pt-2 flex justify-center">
              <RiskBadge level={riskResult.level} />
            </div>
            <Button
              onClick={onComplete}
              className="w-full h-12 rounded-xl mt-6 font-semibold shadow-md text-base"
            >
              Continue
            </Button>
          </div>
        </div>
      );
    }
    const nextMember = otherPendingMembers[0];
    return (
      <div className="min-h-screen bg-background p-4 max-w-lg mx-auto flex flex-col justify-center space-y-6 animate-in fade-in">
        <div className="card-surface ios-glass p-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-3 shadow-md">
          <div className="size-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="size-8 stroke-[2.5]" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">Assessment Complete!</h2>
          <p className="text-sm text-muted-foreground">
            Health assessment successfully saved for{" "}
            <span className="font-bold text-foreground">{member.name}</span> (ID: {member.memberId}
            ).
          </p>
          <div className="pt-2 flex justify-center">
            <RiskBadge level={riskResult.level} />
          </div>
        </div>

        {nextMember ? (
          <div className="card-surface p-5 rounded-2xl border border-primary/30 bg-primary-soft/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Next Household Member
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                Assessment Pending
              </span>
            </div>
            <div>
              <p className="font-bold text-base text-foreground">{nextMember.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {nextMember.memberId} • Age {nextMember.age} • {nextMember.gender}
              </p>
            </div>
            <Button
              asChild
              className="w-full h-12 rounded-xl font-semibold bg-primary text-white shadow-xs"
            >
              <Link to="/assessments/$memberId" params={{ memberId: nextMember.id }}>
                <Stethoscope className="size-4 mr-2" /> Assess {nextMember.name} Now
              </Link>
            </Button>
          </div>
        ) : (
          <div className="card-surface p-5 rounded-2xl border border-border/70 text-center space-y-2">
            <p className="font-bold text-sm text-foreground">All Eligible Members Assessed!</p>
            <p className="text-xs text-muted-foreground">
              Survey completed for Household {member.houseId}.
            </p>
          </div>
        )}

        <Button asChild variant="outline" className="w-full h-12 rounded-xl font-semibold">
          <Link to="/houses/$houseId" params={{ houseId: member.houseUuid ?? "" }}>
            View Household Details
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-28">
      {/* iOS Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => {
            if (step > 1) handleBack();
            else if (onCancel) onCancel();
            else
              navigate({
                to: "/houses/$houseId",
                params: { houseId: houseUuid ?? member.houseUuid ?? "" },
              });
          }}
          className="flex items-center text-primary text-sm font-medium hover:opacity-80"
        >
          <ChevronLeft className="size-5 -ml-1" />
          {step > 1 ? "Back" : "Close"}
        </button>
        <div className="text-center truncate px-2 max-w-[200px]">
          <h1 className="font-display font-bold text-base truncate">{member.name}</h1>
          <p className="text-[10px] text-primary font-mono font-semibold">{member.memberId}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen(true)}
            className="p-2 -mr-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
          >
            <History className="size-5" />
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-border/50 w-full">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-3xl sm:max-w-md sm:mx-auto p-0 flex flex-col bg-background/95 backdrop-blur-xl border-t border-border"
        >
          <SheetHeader className="p-4 border-b border-border text-left">
            <SheetTitle className="font-display flex items-center gap-2">
              <History className="size-5 text-primary" />
              Member History Timeline
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {isLoadingHistory ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Loading history...
              </div>
            ) : !memberHistory?.assessments?.length && !memberHistory?.followUps?.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No historical records found.
              </div>
            ) : (
              <div className="relative border-l-2 border-border/50 ml-4 pl-6 space-y-8">
                {/* Assessments */}
                {memberHistory.assessments.map((assmt: any) => (
                  <div key={assmt.id} className="relative">
                    <div className="absolute -left-[35px] bg-background border-2 border-primary rounded-full p-1">
                      <Stethoscope className="size-3 text-primary" />
                    </div>
                    <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-foreground">Health Assessment</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(assmt.assessed_at || assmt.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {assmt.systolic && assmt.diastolic && (
                          <span className="px-2 py-0.5 rounded-md bg-surface-muted text-[10px] font-mono border border-border">
                            BP: {assmt.systolic}/{assmt.diastolic}
                          </span>
                        )}
                        {assmt.blood_sugar && (
                          <span className="px-2 py-0.5 rounded-md bg-surface-muted text-[10px] font-mono border border-border">
                            Sugar: {assmt.blood_sugar}
                          </span>
                        )}
                        {assmt.risk_level && (
                          <span className="px-2 py-0.5 rounded-md bg-surface-muted text-[10px] font-bold border border-border uppercase">
                            Risk: {assmt.risk_level}
                          </span>
                        )}
                      </div>
                      {assmt.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">"{assmt.notes}"</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Follow Ups */}
                {memberHistory.followUps.map((fu: any) => (
                  <div key={fu.id} className="relative">
                    <div className="absolute -left-[35px] bg-background border-2 border-amber-500 rounded-full p-1">
                      <Calendar className="size-3 text-amber-500" />
                    </div>
                    <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-foreground">
                          Follow-up{" "}
                          {fu.status === "completed"
                            ? "Completed"
                            : fu.status === "missed"
                              ? "Missed"
                              : "Scheduled"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Due: {fu.due_date}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">{fu.reason}</p>
                      <div className="pt-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            fu.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : fu.status === "missed"
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          )}
                        >
                          {fu.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="p-4 max-w-lg mx-auto w-full space-y-6 pt-3 animate-in fade-in duration-200">
        {/* STEP 1: PERSONAL & KNOWN HISTORY */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Step 1: History & Conditions
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Known medical conditions and availability.
              </p>
            </div>

            <div className="card-surface p-4 rounded-2xl border border-border/70 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Member Present for Survey</p>
                <p className="text-xs text-muted-foreground">
                  Turn off if member is currently unavailable.
                </p>
              </div>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>

            <div className="space-y-2.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Assessment Status
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setKnownHistoryStatus("none");
                    setConditions([]);
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-left font-semibold text-xs transition-all",
                    knownHistoryStatus === "none"
                      ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20"
                      : "bg-surface text-muted-foreground border-border hover:bg-surface-muted",
                  )}
                >
                  NO KNOWN HISTORY
                </button>
                <button
                  type="button"
                  onClick={() => setKnownHistoryStatus("known")}
                  className={cn(
                    "p-3 rounded-2xl border text-left font-semibold text-xs transition-all",
                    knownHistoryStatus === "known"
                      ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20"
                      : "bg-surface text-muted-foreground border-border hover:bg-surface-muted",
                  )}
                >
                  KNOWN CONDITIONS
                </button>
              </div>
            </div>

            {knownHistoryStatus === "known" && (
              <div className="card-surface p-4 rounded-2xl border border-primary/20 bg-primary-soft/10 space-y-3 animate-in fade-in">
                <Label className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Select Known Conditions
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Hypertension",
                    "Diabetes",
                    "Heart Disease",
                    "Stroke",
                    "Cancer",
                    "Asthma",
                    "Other",
                  ].map((cond) => {
                    const active = conditions.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() =>
                          setConditions((prev) =>
                            prev.includes(cond) ? prev.filter((x) => x !== cond) : [...prev, cond],
                          )
                        }
                        className={cn(
                          "p-2.5 rounded-xl border text-xs font-semibold transition-all text-left flex justify-between items-center",
                          active
                            ? "bg-primary text-white border-primary shadow-xs"
                            : "bg-surface text-foreground border-border/70 hover:bg-surface-muted",
                        )}
                      >
                        <span>{cond}</span>
                        {active && <CheckCircle2 className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>

                {conditions.includes("Hypertension") && (
                  <div className="space-y-1 pt-2 animate-in fade-in">
                    <Label className="text-xs text-foreground font-medium">
                      Tablets Taking for Hypertension
                    </Label>
                    <Input
                      value={htnMedication}
                      onChange={(e) => setHtnMedication(e.target.value)}
                      placeholder="e.g. Amlodipine 5mg, Telmisartan 40mg"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                )}

                {conditions.includes("Diabetes") && (
                  <div className="space-y-1 pt-2 animate-in fade-in">
                    <Label className="text-xs text-foreground font-medium">
                      Tablets / Insulin for Diabetes
                    </Label>
                    <Input
                      value={dmMedication}
                      onChange={(e) => setDmMedication(e.target.value)}
                      placeholder="e.g. Metformin 500mg, Glimepiride"
                      className="h-10 rounded-xl text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: LIFESTYLE & SUBSTANCE USE */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Step 2: Lifestyle & Habits
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Progressive disclosure for substance use & activity.
              </p>
            </div>

            {/* Alcohol */}
            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Alcohol Consumption
                </Label>
                {alcohol !== "No" && (
                  <button
                    type="button"
                    onClick={() => setAlcoholSheetOpen(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Freq: {alcoholFreq || "Set Frequency"}
                  </button>
                )}
              </div>
              <ToggleGroup
                type="single"
                value={alcohol}
                onValueChange={(v) => {
                  if (v) {
                    setAlcohol(v);
                    if (v !== "No") setAlcoholSheetOpen(true);
                  }
                }}
                className="justify-start bg-surface-muted p-1 rounded-xl w-full border border-border/50"
              >
                <ToggleGroupItem value="No" className="rounded-lg flex-1 text-xs font-semibold">
                  No
                </ToggleGroupItem>
                <ToggleGroupItem value="Yes" className="rounded-lg flex-1 text-xs font-semibold">
                  Yes
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="Used to"
                  className="rounded-lg flex-1 text-xs font-semibold"
                >
                  Past / Used to
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Smoking */}
            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Smoking
                </Label>
                {smoking !== "No" && (
                  <button
                    type="button"
                    onClick={() => setSmokingSheetOpen(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Freq: {smokingFreq || "Set Frequency"}
                  </button>
                )}
              </div>
              <ToggleGroup
                type="single"
                value={smoking}
                onValueChange={(v) => {
                  if (v) {
                    setSmoking(v);
                    if (v !== "No") setSmokingSheetOpen(true);
                  }
                }}
                className="justify-start bg-surface-muted p-1 rounded-xl w-full border border-border/50"
              >
                <ToggleGroupItem value="No" className="rounded-lg flex-1 text-xs font-semibold">
                  No
                </ToggleGroupItem>
                <ToggleGroupItem value="Yes" className="rounded-lg flex-1 text-xs font-semibold">
                  Yes
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="Used to"
                  className="rounded-lg flex-1 text-xs font-semibold"
                >
                  Past / Used to
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Tobacco */}
            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Other Tobacco (Chewing/Snuff)
                </Label>
                {tobacco !== "No" && (
                  <button
                    type="button"
                    onClick={() => setTobaccoSheetOpen(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Freq: {tobaccoFreq || "Set Frequency"}
                  </button>
                )}
              </div>
              <ToggleGroup
                type="single"
                value={tobacco}
                onValueChange={(v) => {
                  if (v) {
                    setTobacco(v);
                    if (v !== "No") setTobaccoSheetOpen(true);
                  }
                }}
                className="justify-start bg-surface-muted p-1 rounded-xl w-full border border-border/50"
              >
                <ToggleGroupItem value="No" className="rounded-lg flex-1 text-xs font-semibold">
                  No
                </ToggleGroupItem>
                <ToggleGroupItem value="Yes" className="rounded-lg flex-1 text-xs font-semibold">
                  Yes
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="Used to"
                  className="rounded-lg flex-1 text-xs font-semibold"
                >
                  Past / Used to
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Waist Measurement */}
            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Waist Measurement
                </Label>
                <span className="text-[11px] font-mono font-bold text-primary">
                  {Number(waistCm) >= 100
                    ? "≥ 100 cm (High)"
                    : Number(waistCm) >= 90
                      ? "90–100 cm (Mod)"
                      : "< 90 cm (Normal)"}
                </span>
              </div>
              <Input
                type="number"
                inputMode="numeric"
                value={waistCm}
                onChange={(e) => setWaistCm(e.target.value)}
                placeholder="e.g. 88"
                className="h-11 rounded-xl text-center font-mono font-semibold"
              />
            </div>

            {/* Physical Activity */}
            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Physical Activity (Minutes / Week)
              </Label>
              <ToggleGroup
                type="single"
                value={physicalActivity}
                onValueChange={(v) => v && setPhysicalActivity(v)}
                className="justify-start bg-surface-muted p-1 rounded-xl w-full border border-border/50"
              >
                <ToggleGroupItem value=">=150" className="rounded-lg flex-1 text-xs font-semibold">
                  ≥ 150 min / week (Active)
                </ToggleGroupItem>
                <ToggleGroupItem value="<150" className="rounded-lg flex-1 text-xs font-semibold">
                  &lt; 150 min / week (Sedentary)
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Family History */}
            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Family Medical History
                </Label>
                {familyHistory === "Yes" && (
                  <button
                    type="button"
                    onClick={() => setFamilyHistorySheetOpen(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    {familyConditions.length} condition(s) selected
                  </button>
                )}
              </div>
              <ToggleGroup
                type="single"
                value={familyHistory}
                onValueChange={(v) => {
                  if (v) {
                    setFamilyHistory(v as any);
                    if (v === "Yes") setFamilyHistorySheetOpen(true);
                  }
                }}
                className="justify-start bg-surface-muted p-1 rounded-xl w-full border border-border/50"
              >
                <ToggleGroupItem value="No" className="rounded-lg flex-1 text-xs font-semibold">
                  No Family History
                </ToggleGroupItem>
                <ToggleGroupItem value="Yes" className="rounded-lg flex-1 text-xs font-semibold">
                  Yes, Present
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Frequency Sheets */}
            <LifestyleFrequencySheet
              open={alcoholSheetOpen}
              onOpenChange={setAlcoholSheetOpen}
              title="Alcohol Consumption Frequency"
              subtitle="Select how frequently alcohol is consumed."
              value={alcoholFreq}
              onSelect={setAlcoholFreq}
            />
            <LifestyleFrequencySheet
              open={smokingSheetOpen}
              onOpenChange={setSmokingSheetOpen}
              title="Smoking Frequency"
              subtitle="Select daily / weekly smoking frequency."
              value={smokingFreq}
              onSelect={setSmokingFreq}
            />
            <LifestyleFrequencySheet
              open={tobaccoSheetOpen}
              onOpenChange={setTobaccoSheetOpen}
              title="Tobacco Frequency"
              subtitle="Select smokeless tobacco consumption frequency."
              value={tobaccoFreq}
              onSelect={setTobaccoFreq}
            />
            <FamilyHistorySheet
              open={familyHistorySheetOpen}
              onOpenChange={setFamilyHistorySheetOpen}
              selectedConditions={familyConditions}
              onChange={setFamilyConditions}
            />
          </div>
        )}

        {/* STEP 3: HEIGHT, WEIGHT & BMI */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Step 3: Height, Weight & BMI
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatic BMI computation and category classification.
              </p>
            </div>

            <div className="card-surface p-5 rounded-2xl border border-border/70 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Height (cm)
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="165"
                    className="h-12 rounded-xl text-center font-mono font-bold text-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Weight (kg)
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="68"
                    className="h-12 rounded-xl text-center font-mono font-bold text-lg"
                  />
                </div>
              </div>

              {bmiNum != null && (
                <div className="p-4 rounded-2xl bg-surface-muted border border-border/60 text-center space-y-1 animate-in zoom-in-95">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Derived Body Mass Index
                  </span>
                  <p className="font-display font-bold text-3xl text-foreground font-mono">
                    {bmiNum}
                  </p>
                  <p className={cn("text-xs font-bold", bmiCategory?.color)}>
                    {bmiCategory?.label}
                  </p>
                </div>
              )}
            </div>

            {/* Total Lifestyle Score Widget */}
            <div className="card-surface p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600 ">
                  Calculated Lifestyle Risk Score
                </span>
                <p className="font-display font-bold text-xl text-foreground">
                  {lifestyleRiskScore} / 25
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {lifestyleRiskScore >= 8
                  ? "High Risk"
                  : lifestyleRiskScore >= 4
                    ? "Moderate Risk"
                    : "Low Risk"}
              </span>
            </div>
          </div>
        )}

        {/* STEP 4: CLINICAL VITALS & RISK FACTORS */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Step 4: Clinical Vital Signs
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Accurate blood pressure and blood glucose screening.
              </p>
            </div>

            {/* Blood Pressure Card */}
            <div className="card-surface p-5 rounded-2xl border border-border/70 space-y-3.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Heart className="size-4 text-rose-500" /> Blood Pressure (mmHg)
                </Label>
                <RiskFactorsSheetButton
                  title="VIEW BP RISK FACTORS"
                  type="bp"
                  currentValue={systolic && diastolic ? `${systolic}/${diastolic}` : null}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Systolic (mmHg)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    placeholder="120"
                    className="h-12 rounded-xl text-center font-mono font-bold text-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Diastolic (mmHg)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    placeholder="80"
                    className="h-12 rounded-xl text-center font-mono font-bold text-lg"
                  />
                </div>
              </div>
            </div>

            {/* Blood Sugar Card */}
            <div className="card-surface p-5 rounded-2xl border border-border/70 space-y-3.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Activity className="size-4 text-amber-500" /> Random Blood Sugar (mg/dL)
                </Label>
                <RiskFactorsSheetButton
                  title="VIEW SUGAR RISK FACTORS"
                  type="sugar"
                  currentValue={sugar ? `${sugar} mg/dL` : null}
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={sugar}
                  onChange={(e) => setSugar(e.target.value)}
                  placeholder="e.g. 110"
                  className="h-12 rounded-xl text-center font-mono font-bold text-lg"
                />
              </div>
            </div>

            {/* Optional Extra Vitals */}
            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Additional Vitals (Optional)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Pulse (bpm)</Label>
                  <Input
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="72"
                    className="h-10 rounded-xl text-center font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Temp (°F)</Label>
                  <Input
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="98.6"
                    className="h-10 rounded-xl text-center font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">SpO2 (%)</Label>
                  <Input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    placeholder="98"
                    className="h-10 rounded-xl text-center font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: REFERRAL & COMMENTS */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Step 5: Facility Referral & Notes
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Facility referral and surveyor observations.
              </p>
            </div>

            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    REFER TO CLINIC / HOSPITAL?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check if doctor consultation is indicated.
                  </p>
                </div>
                <Switch checked={referralNeeded} onCheckedChange={setReferralNeeded} />
              </div>

              {referralNeeded && (
                <div className="space-y-3 pt-3 border-t border-border/50 animate-in fade-in">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Select Referral Destination
                    </Label>
                    <div className="space-y-1.5">
                      {referralDestinations.map((dest) => (
                        <button
                          key={dest.id}
                          type="button"
                          onClick={() => setReferralDestinationId(dest.id)}
                          className={cn(
                            "w-full p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all",
                            referralDestinationId === dest.id
                              ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20"
                              : "bg-surface text-foreground border-border hover:bg-surface-muted",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 shrink-0 text-muted-foreground" />
                            <div>
                              <p className="font-bold">{dest.name}</p>
                              <p className="text-[10px] text-muted-foreground font-normal">
                                {dest.address}
                              </p>
                            </div>
                          </div>
                          {referralDestinationId === dest.id && (
                            <CheckCircle2 className="size-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {referralDestinationId === "dest_other" && (
                    <div className="space-y-1 pt-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Custom Destination Name
                      </Label>
                      <Input
                        value={customDestination}
                        onChange={(e) => setCustomDestination(e.target.value)}
                        placeholder="e.g. St. Joseph Memorial Clinic"
                        className="h-10 rounded-xl text-xs"
                      />
                    </div>
                  )}

                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Referral Clinical Notes
                    </Label>
                    <Textarea
                      value={referralNotes}
                      onChange={(e) => setReferralNotes(e.target.value)}
                      placeholder="Reason for referral, urgent flags..."
                      rows={2}
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="card-surface p-4 rounded-2xl border border-border/70 space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Survey / Screening Comments
              </Label>
              <Textarea
                value={screeningNotes}
                onChange={(e) => setScreeningNotes(e.target.value)}
                placeholder="Observations, health advice given..."
                rows={3}
                className="rounded-xl text-xs"
              />
            </div>
          </div>
        )}

        {/* STEP 6: SUMMARY & RISK VERIFICATION */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                Step 6: Review & Finalize
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verify derived risk tier and submit assessment.
              </p>
            </div>

            <div className="card-surface p-5 rounded-2xl border border-border/70 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <span className="text-sm font-semibold text-foreground">
                  Derived Clinical Risk Tier
                </span>
                <RiskBadge level={riskResult.level} />
              </div>

              {riskResult.reasons.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Contributing Factors
                  </span>
                  {riskResult.reasons.map((reason, i) => (
                    <p key={i} className="text-xs text-foreground flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary" /> {reason}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No elevated clinical risk criteria detected.
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center font-mono text-xs">
                <div className="bg-surface-muted p-2.5 rounded-xl">
                  <span className="text-[10px] text-muted-foreground uppercase block">BP</span>
                  <span className="font-bold">
                    {systolic && diastolic ? `${systolic}/${diastolic}` : "—"}
                  </span>
                </div>
                <div className="bg-surface-muted p-2.5 rounded-xl">
                  <span className="text-[10px] text-muted-foreground uppercase block">Sugar</span>
                  <span className="font-bold">{sugar ? `${sugar} mg/dL` : "—"}</span>
                </div>
                <div className="bg-surface-muted p-2.5 rounded-xl">
                  <span className="text-[10px] text-muted-foreground uppercase block">BMI</span>
                  <span className="font-bold">{bmiNum ?? "—"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-background/90 backdrop-blur-md border-t border-border z-30 flex gap-3 safe-bottom shadow-[0_-4px_24px_-2px_oklch(0_0_0/0.05)]">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="w-1/3 h-12 rounded-xl text-base font-semibold shadow-sm"
          >
            Back
          </Button>
        )}
        {step < totalSteps ? (
          <Button
            onClick={handleNext}
            className={cn(
              "h-12 rounded-xl text-base font-semibold shadow-sm flex items-center justify-center gap-2",
              step > 1 ? "w-2/3" : "w-full",
            )}
          >
            Next <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isCHW}
            className={cn(
              "h-12 rounded-xl text-base font-bold shadow-md bg-primary text-white",
              step > 1 ? "w-2/3" : "w-full",
            )}
          >
            {mutation.isPending ? "Submitting…" : "Save"}
            <Save className="size-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
