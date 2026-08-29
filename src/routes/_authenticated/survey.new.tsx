import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  CheckCircle2,
  Home,
  MapPin,
  Users,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  ArrowRight,
  Save,
  Check,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import React from "react";

import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import {
  createHouseWithDetails,
  buildCanonicalHouseId,
  type CreateHouseMemberInput,
} from "@/services/houseService";
import { HouseIdBuilder } from "@/components/houses/HouseIdBuilder";
import { HouseLocationPicker } from "@/components/houses/HouseLocationPicker";
import { MemberSlotList } from "@/components/houses/MemberSlotList";
import { MemberAssessmentForm } from "@/components/screening/MemberAssessmentForm";
import { AddMemberSheet } from "@/components/houses/AddMemberSheet";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const surveyNewSearchSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  accuracy: z.number().optional(),
  block: z.string().optional(),
  lane: z.string().optional(),
  serial: z.string().optional(),
  housingType: z.string().optional(),
  step: z.number().optional(),
  houseId: z.string().optional(),
  mode: z.enum(["new", "existing"]).optional(),
});

export const Route = createFileRoute("/_authenticated/survey/new")({
  validateSearch: surveyNewSearchSchema,
  component: CreateHousePage,
});

const STEPS = [
  { step: 1, title: "House ID", icon: Home },
  { step: 2, title: "Location & Pin", icon: MapPin },
  { step: 3, title: "Availability", icon: CheckCircle2 },
  { step: 4, title: "Household", icon: Users },
  { step: 5, title: "Members", icon: Users },
  { step: 6, title: "30+ Health Hub", icon: Stethoscope },
];

function CreateHousePage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const { data } = useDataset();
  const refresh = useRefreshDataset();
  const { role } = useAuth();
  const isCHW = role === "survey_user";

  const [currentStep, setCurrentStep] = useState(
    searchParams.houseId ? 6 : searchParams.mode === "new" ? 1 : searchParams.step ?? 0
  );
  const [activeAssessmentMemberId, setActiveAssessmentMemberId] = useState<string | null>(null);
  const [completedMemberIds, setCompletedMemberIds] = useState<string[]>([]);

  // Step 1: House ID (Prefilled if passed via search params)
  const [block, setBlock] = useState(searchParams.block ?? "B1");
  const [lane, setLane] = useState(searchParams.lane ?? "L1");
  const [serialNo, setSerialNo] = useState(searchParams.serial ?? "001");
  const [housingType, setHousingType] = useState(searchParams.housingType ?? "Pakka");

  // Step 2: Location & Pin (Prefilled if passed via search params)
  const [latitude, setLatitude] = useState<number | null>(searchParams.lat ?? null);
  const [longitude, setLongitude] = useState<number | null>(searchParams.lng ?? null);
  const [accuracy, setAccuracy] = useState<number | null>(searchParams.accuracy ?? null);
  const [address, setAddress] = useState("");
  const [pinType, setPinType] = useState("house");
  const [customType, setCustomType] = useState("");

  // Step 3: Availability
  const [availability, setAvailability] = useState<"AVAILABLE" | "NOT_AVAILABLE">("AVAILABLE");
  const [unavailableReason, setUnavailableReason] = useState("No Response");
  const [unavailableNotes, setUnavailableNotes] = useState("");

  // Step 4: Household Details
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");
  const [earningMembers, setEarningMembers] = useState<string>("1");
  const [totalMembersCount, setTotalMembersCount] = useState<number>(3);

  // Step 5: Members
  const [members, setMembers] = useState<CreateHouseMemberInput[]>([
    { name: "", age: 35, gender: "Male" },
    { name: "", age: 32, gender: "Female" },
    { name: "", age: 10, gender: "Male" },
  ]);

  // Persisted Created House State after Step 5 completion
  const [createdHouseUuid, setCreatedHouseUuid] = useState<string | null>(null);
  const [createdMembersList, setCreatedMembersList] = useState<any[]>([]);

  // Existing house IDs for unique serial calculation
  const existingHouseIds = useMemo(() => {
    return (data?.houses ?? []).map((h) => h.house.house_id).filter(Boolean) as string[];
  }, [data]);

  const houseId = buildCanonicalHouseId(block, lane, serialNo, housingType);
  const [houseSearch, setHouseSearch] = useState("");

  const filteredHouses = useMemo(() => {
    if (!houseSearch) return [];
    return (data?.houses ?? []).filter(h => 
      h.house.house_id?.toLowerCase().includes(houseSearch.toLowerCase()) || 
      h.house.id.toLowerCase().includes(houseSearch.toLowerCase())
    ).slice(0, 5);
  }, [data, houseSearch]);

  React.useEffect(() => {
    if (searchParams.houseId && data?.houses) {
      const foundHouse = data.houses.find(
        (h) => h.house.id === searchParams.houseId || h.house.house_id === searchParams.houseId
      );
      if (foundHouse) {
        setCreatedHouseUuid(foundHouse.house.id);
        setCreatedMembersList(foundHouse.members || []);
        if (currentStep < 6) {
          setCurrentStep(6);
        }
      }
    }
  }, [searchParams.houseId, data?.houses, currentStep]);

  // When step 6 is active and we add members, we need to refresh the createdMembersList from data.houses
  React.useEffect(() => {
    if (currentStep === 6 && createdHouseUuid && data?.houses) {
      const foundHouse = data.houses.find(h => h.house.id === createdHouseUuid);
      if (foundHouse) {
        if ((foundHouse.members?.length || 0) !== createdMembersList.length) {
          setCreatedMembersList(foundHouse.members || []);
        }
      }
    }
  }, [data?.houses, createdHouseUuid, currentStep, createdMembersList.length]);

  const activeHouseId = data?.houses?.find(h => h.house.id === createdHouseUuid)?.house.house_id ?? houseId;

  // Sync member slots count with total members input
  const handleTotalMembersChange = (count: number) => {
    setTotalMembersCount(count);
    const current = [...members];
    if (count > current.length) {
      const diff = count - current.length;
      for (let i = 0; i < diff; i++) {
        current.push({ name: "", age: null, gender: "Male" });
      }
    } else if (count < current.length) {
      current.splice(count);
    }
    setMembers(current);
  };

  const handleMembersChange = (updatedMembers: CreateHouseMemberInput[]) => {
    setMembers(updatedMembers);
    setTotalMembersCount(updatedMembers.length);
  };

  // House creation mutation
  const createMutation = useMutation({
    mutationFn: async (isDirectSave: boolean) => {
      // Validate members if available
      if (availability === "AVAILABLE") {
        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          if (!m?.name.trim()) {
            throw new Error(`Please enter the name for Member #${i + 1}.`);
          }
          if (m.age == null || m.age < 0 || m.age > 120) {
            throw new Error(`Please enter a valid age for Member #${i + 1} (${m?.name}).`);
          }
        }
      }

      return await createHouseWithDetails({
        block,
        lane,
        serialNo,
        housingType,
        houseId,
        latitude,
        longitude,
        accuracy,
        address,
        pinType,
        customType: pinType === "other" ? customType : null,
        availability,
        unavailableReason:
          availability === "NOT_AVAILABLE"
            ? `${unavailableReason}${unavailableNotes ? `: ${unavailableNotes}` : ""}`
            : null,
        monthlyIncome: monthlyIncome ? Number(monthlyIncome) : null,
        earningMembers: earningMembers ? Number(earningMembers) : null,
        totalMembers: members.length,
        members: availability === "AVAILABLE" ? members : [],
      });
    },
    onSuccess: (result) => {
      toast.success(`Household ${houseId} created successfully!`);
      void refresh();
      setCreatedHouseUuid(result.house.id);
      setCreatedMembersList(result.members ?? []);

      if (availability === "NOT_AVAILABLE") {
        // Finished for unavailable house
        navigate({ to: "/houses/$houseId", params: { houseId: result.house.id } });
      } else {
        // Move to Step 6: 30+ Health Assessment Hub
        setCurrentStep(6);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create house.");
    },
  });

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!serialNo.trim()) {
        toast.error("Please enter a serial number.");
        return;
      }
      setCurrentStep(2); // Step 2: Location & Pin immediately after House ID
    } else if (currentStep === 2) {
      setCurrentStep(3); // Step 3: Availability
    } else if (currentStep === 3) {
      if (availability === "NOT_AVAILABLE") {
        // Save right away
        createMutation.mutate(true);
      } else {
        setCurrentStep(4); // Step 4: Household Details
      }
    } else if (currentStep === 4) {
      setCurrentStep(5); // Step 5: Members
    } else if (currentStep === 5) {
      createMutation.mutate(false);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 6 && searchParams.houseId) {
      navigate({ to: "/houses" });
    } else if (currentStep > 0) {
      if (currentStep === 1 && searchParams.mode !== "new") {
        setCurrentStep(0);
      } else if (currentStep === 1) {
        navigate({ to: "/houses" });
      } else {
        setCurrentStep((s: number) => s - 1);
      }
    } else {
      navigate({ to: "/houses" });
    }
  };

  const eligible30Plus = useMemo(() => {
    return createdMembersList.filter((m) => {
      const age = m.data?.age != null ? Number(m.data.age) : null;
      return age != null && age >= 30;
    });
  }, [createdMembersList]);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* iOS Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <button
          onClick={handlePrevStep}
          className="flex items-center text-primary text-sm font-medium hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="size-5 -ml-1" />
          {currentStep > 1 ? "Back" : "Households"}
        </button>
        <div className="text-center">
          <h1 className="font-display font-bold text-base truncate">
            {currentStep === 6 ? "30+ Health Hub" : currentStep === 0 ? "Select Mode" : "Create House"}
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono font-semibold">{currentStep === 6 ? activeHouseId : houseId}</p>
        </div>
        <div className="w-16 text-right">
          <span className="text-xs text-muted-foreground font-medium">
            Step {Math.max(1, currentStep)} of {STEPS.length}
          </span>
        </div>
      </header>

      {/* iOS Progress Bar */}
      <div className="h-1 bg-border/50 w-full">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Main Form Container */}
      <main className="p-4 max-w-lg mx-auto w-full space-y-6 pt-4 animate-in fade-in duration-200">
        {/* STEP 0: MODE SELECTION */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Start Assessment</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a new house or select an existing one to begin.
              </p>
            </div>
            
            <Button 
              className="w-full h-14 rounded-2xl text-base font-semibold shadow-md bg-primary text-white flex items-center justify-center gap-2"
              onClick={() => setCurrentStep(1)}
            >
              <Home className="size-5" /> Create New House
            </Button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-border"></div>
              <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">OR</span>
              <div className="flex-grow border-t border-border"></div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground">Search Existing House</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Enter House ID (e.g. B1-L1...)"
                  className="pl-9 h-12 rounded-xl"
                  value={houseSearch}
                  onChange={(e) => setHouseSearch(e.target.value)}
                />
              </div>
              {houseSearch && filteredHouses.length > 0 && (
                <div className="space-y-2 animate-in fade-in">
                  {filteredHouses.map((h) => (
                    <button
                      key={h.house.id}
                      onClick={() => {
                        setCreatedHouseUuid(h.house.id);
                        setCreatedMembersList(h.members || []);
                        setCurrentStep(6);
                      }}
                      className="w-full text-left p-4 rounded-xl border border-border/70 bg-surface hover:bg-surface-muted flex items-center justify-between transition-all"
                    >
                      <div>
                        <p className="font-bold text-sm">{h.house.house_id}</p>
                        <p className="text-xs text-muted-foreground">{h.members?.length || 0} Members</p>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              {houseSearch && filteredHouses.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No houses found matching "{houseSearch}"</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: HOUSE ID */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Step 1: House Identification</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure Block, Lane, Serial Number, and Housing Type.
              </p>
            </div>

            <HouseIdBuilder
              existingHouseIds={existingHouseIds}
              block={block}
              lane={lane}
              serialNo={serialNo}
              housingType={housingType}
              onBlockChange={setBlock}
              onLaneChange={setLane}
              onSerialNoChange={setSerialNo}
              onHousingTypeChange={setHousingType}
            />
          </div>
        )}

        {/* STEP 2: LOCATION & PIN */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Step 2: House Location & Map Pin</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pin GPS coordinates and choose the feature type for this house.
              </p>
            </div>

            <HouseLocationPicker
              houseId={houseId}
              latitude={latitude}
              longitude={longitude}
              accuracy={accuracy}
              address={address}
              pinType={pinType}
              customType={customType}
              onLocationChange={(lat, lng, acc) => {
                setLatitude(lat);
                setLongitude(lng);
                setAccuracy(acc);
              }}
              onAddressChange={setAddress}
              onPinTypeChange={setPinType}
              onCustomTypeChange={setCustomType}
            />
          </div>
        )}

        {/* STEP 3: AVAILABILITY */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Step 3: Survey Availability</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Is this household currently available for survey?</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAvailability("AVAILABLE")}
                className={cn(
                  "p-4 rounded-2xl border text-left flex items-start gap-3 transition-all",
                  availability === "AVAILABLE"
                    ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 text-foreground"
                    : "bg-surface text-muted-foreground border-border/70 hover:bg-surface-muted"
                )}
              >
                <div
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center shrink-0",
                    availability === "AVAILABLE" ? "bg-emerald-500 text-white" : "bg-surface-muted text-muted-foreground"
                  )}
                >
                  <Check className="size-4 stroke-[3]" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">AVAILABLE</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Family is present. Proceed with household & member assessment.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAvailability("NOT_AVAILABLE")}
                className={cn(
                  "p-4 rounded-2xl border text-left flex items-start gap-3 transition-all",
                  availability === "NOT_AVAILABLE"
                    ? "bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20 text-foreground"
                    : "bg-surface text-muted-foreground border-border/70 hover:bg-surface-muted"
                )}
              >
                <div
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center shrink-0",
                    availability === "NOT_AVAILABLE" ? "bg-rose-500 text-white" : "bg-surface-muted text-muted-foreground"
                  )}
                >
                  <CheckCircle2 className="size-4 stroke-[2]" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">NOT AVAILABLE</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Locked, refused, or moved. Save status without member assessment.
                  </p>
                </div>
              </button>
            </div>

            {/* Unavailable Reason Selector */}
            {availability === "NOT_AVAILABLE" && (
              <div className="card-surface p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 space-y-3.5 animate-in fade-in">
                <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Reason for Non-Availability
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {["No Response", "Locked", "Refused", "Moved", "Other"].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setUnavailableReason(reason)}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-semibold transition-all",
                        unavailableReason === reason
                          ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                          : "bg-surface text-foreground border-border hover:bg-surface-muted"
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-muted-foreground">Notes / Comments</Label>
                  <Input
                    value={unavailableNotes}
                    onChange={(e) => setUnavailableNotes(e.target.value)}
                    placeholder="e.g. Neighbor mentioned returning in 2 weeks"
                    className="h-10 rounded-xl text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: HOUSEHOLD DETAILS */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Step 4: Household Details</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Income and family size details.</p>
            </div>

            <div className="card-surface p-5 rounded-2xl border border-border/70 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Monthly Family Income (₹)
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  placeholder="e.g. 25000"
                  className="h-12 rounded-xl text-lg font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Earning Members
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={earningMembers}
                    onChange={(e) => setEarningMembers(e.target.value)}
                    placeholder="1"
                    className="h-12 rounded-xl text-center font-mono font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Total Members
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={totalMembersCount}
                    onChange={(e) => handleTotalMembersChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-12 rounded-xl text-center font-mono font-semibold"
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Total Members will automatically prepare {totalMembersCount} member entry slots in the next step.
              </p>
            </div>
          </div>
        )}

        {/* STEP 5: MEMBERS */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Step 5: Household Members</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enter names and ages. Eligible 30+ members receive automatic Member IDs.
              </p>
            </div>

            <MemberSlotList
              houseId={houseId}
              members={members}
              onMembersChange={handleMembersChange}
            />
          </div>
        )}

        {/* STEP 6: 30+ HEALTH ASSESSMENT HUB */}
        {currentStep === 6 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="card-surface ios-glass p-5 rounded-2xl border border-primary/20 bg-primary-soft/20 text-center space-y-2">
              <div className="size-12 rounded-2xl bg-primary text-white flex items-center justify-center mx-auto shadow-md">
                <Sparkles className="size-6" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground">Survey Recorded!</h2>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Household <span className="font-mono font-bold text-primary">{houseId}</span> saved with {members.length} members.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  30+ Members for Health Assessment ({eligible30Plus.length})
                </Label>
                {createdHouseUuid && (
                  <AddMemberSheet 
                    houseUuid={createdHouseUuid} 
                    houseId={activeHouseId}
                    currentMembers30Plus={eligible30Plus.length}
                  />
                )}
              </div>

              {eligible30Plus.length === 0 ? (
                <div className="card-surface p-6 rounded-2xl text-center text-muted-foreground space-y-2 border border-border/70">
                  <p className="text-sm font-semibold">No 30+ members in this household.</p>
                  <p className="text-xs">All household records are synchronized.</p>
                  <Button asChild className="rounded-xl mt-3">
                    <Link to="/houses/$houseId" params={{ houseId: createdHouseUuid ?? "" }}>
                      View Household Details
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {eligible30Plus.map((member) => {
                    const mData = (member.data ?? {}) as Record<string, any>;
                    const isAssessed = completedMemberIds.includes(member.id);
                    return (
                      <div
                        key={member.id}
                        className="card-surface p-4 rounded-2xl border border-primary/30 bg-primary-soft/10 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div>
                          <p className="font-bold text-sm text-foreground">{member.member_name}</p>
                          <p className="font-mono text-xs text-primary font-semibold">{member.member_id}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Age {mData["age"] ?? "?"} • {mData["gender"] ?? "Unknown"}
                          </p>
                        </div>

                        {isAssessed ? (
                          <div className="flex flex-col items-end">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Assessed
                            </span>
                          </div>
                        ) : isCHW ? (
                          <Button 
                            size="sm" 
                            className="rounded-xl font-semibold bg-primary text-white shadow-xs"
                            onClick={() => {
                              setActiveAssessmentMemberId(member.id);
                              setCurrentStep(7);
                            }}
                          >
                            <Stethoscope className="size-3.5 mr-1.5" /> Assess Member
                          </Button>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold">
                            Pending
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* STEP 7: MEMBER ASSESSMENT HUB */}
        {currentStep === 7 && activeAssessmentMemberId && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <MemberAssessmentForm 
              memberId={activeAssessmentMemberId}
              {...(createdHouseUuid ? { houseUuid: createdHouseUuid } : {})}
              onComplete={() => {
                setCompletedMemberIds((prev) => [...prev, activeAssessmentMemberId]);
                setActiveAssessmentMemberId(null);
                setCurrentStep(6);
              }}
              onCancel={() => {
                setActiveAssessmentMemberId(null);
                setCurrentStep(6);
              }}
            />
          </div>
        )}
      </main>

      {/* Sticky Bottom Actions */}
      {currentStep > 0 && currentStep < 7 && (
        <div className="fixed bottom-0 inset-x-0 p-4 bg-background/90 backdrop-blur-md border-t border-border z-30 flex gap-3 safe-bottom shadow-[0_-4px_24px_-2px_oklch(0_0_0/0.05)]">
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevStep}
              className="w-1/3 h-12 rounded-xl text-base font-semibold"
            >
              Back
            </Button>
          )}
          {currentStep === 6 ? (
            <Button asChild className={cn("h-12 rounded-xl text-base font-semibold shadow-md", currentStep > 1 ? "w-2/3" : "w-full")}>
              <Link to="/houses/$houseId" params={{ houseId: createdHouseUuid ?? "" }}>
                Finish & Open House Details
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNextStep}
              disabled={createMutation.isPending}
              className={cn("h-12 rounded-xl text-base font-semibold shadow-md flex items-center justify-center gap-2", currentStep > 1 ? "w-2/3" : "w-full")}
            >
              {createMutation.isPending ? (
                "Saving Household…"
              ) : currentStep === 5 || (currentStep === 3 && availability === "NOT_AVAILABLE") ? (
                <>
                  <Save className="size-4" /> Save Household
                </>
              ) : (
                <>
                  Next <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
