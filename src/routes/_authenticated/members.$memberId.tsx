import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, Edit3, User, Home, Activity, Save, History, FileText } from "lucide-react";
import { toast } from "sonner";

import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { tables } from "@/config/database";
import { supabase } from "@/db/client";
import { updateLastFollowUpDate } from "@/services/followUpService";
import type { RiskLevel } from "@/config/risk";

export const Route = createFileRoute("/_authenticated/members/$memberId")({
  component: MemberSummaryPage,
});

function MemberSummaryPage() {
  const { memberId } = Route.useParams();
  const search = Route.useSearch() as { edit?: string; fix?: string };
  const navigate = useNavigate();
  const { data, isLoading } = useDataset();
  const refresh = useRefreshDataset();
  const { role, isAdmin } = useAuth();

  const member = data?.members.find((m) => m.id === memberId);
  const house = data?.byHouseUuid.get(member?.houseUuid ?? "");

  const [isEditing, setIsEditing] = useState(search.edit === "true" || search.fix === "true");
  
  // Edit State
  const [name, setName] = useState(member?.name ?? "");
  const [age, setAge] = useState(member?.age?.toString() ?? "");
  const [gender, setGender] = useState(member?.gender ?? "");
  const [mid, setMid] = useState(member?.memberId === "—" ? "" : (member?.memberId ?? ""));
  const [hid, setHid] = useState(member?.houseId ?? "");

  // Update Last Follow Up State
  const [showLastFollowUp, setShowLastFollowUp] = useState(false);
  const [lastFollowUpDate, setLastFollowUpDate] = useState("");
  const [isUpdatingFollowUp, setIsUpdatingFollowUp] = useState(false);

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading member…</div>;
  if (!member) return <div className="p-12 text-center text-destructive font-semibold">Member record not found.</div>;

  const handleSave = async () => {
    try {
      const parsedAge = parseInt(age, 10);
      
      // We must merge into the `data` jsonb column
      const { data: existing } = await supabase.from(tables.houseMembers).select("data").eq("id", member.id).single();
      const currentData = (existing?.data as Record<string, any>) || {};
      const newData = {
        ...currentData,
        name: name.trim(),
        age: isNaN(parsedAge) ? null : parsedAge,
        gender: gender.trim(),
        house_id: hid.trim() || null,
      };

      const { error } = await supabase
        .from(tables.houseMembers)
        .update({
          member_name: name.trim(),
          member_id: mid.trim() || null,
          data: newData,
          updated_at: new Date().toISOString()
        })
        .eq("id", member.id);

      if (error) throw error;
      
      toast.success("Member profile updated");
      setIsEditing(false);
      void refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update member");
    }
  };

  const handleUpdateLastFollowUp = async () => {
    if (!lastFollowUpDate || !member?.risk) return;
    try {
      setIsUpdatingFollowUp(true);
      await updateLastFollowUpDate(member.id, lastFollowUpDate, member.risk as RiskLevel, []);
      toast.success("Last follow-up date updated");
      setShowLastFollowUp(false);
      void refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update follow-up date");
    } finally {
      setIsUpdatingFollowUp(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="rounded-full bg-surface shadow-sm">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-display font-bold text-foreground truncate">{member.name}</h1>
          <p className="text-sm text-muted-foreground truncate">
            {member.memberId !== "—" ? member.memberId : "No Member ID"} • {house?.house.house_id ? `House ${house.house.house_id}` : "Unmapped House"}
          </p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl shadow-sm hidden sm:flex">
            <Edit3 className="size-4 mr-2" /> Edit Profile
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        <div className="md:col-span-8 space-y-5">
          {/* Main Info Card */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <User className="size-4 text-primary" /> Profile & Demographics
              </h2>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} className="rounded-xl">
                    <Save className="size-3.5 mr-1.5" /> Save
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setIsEditing(true)} variant="ghost" size="icon" className="sm:hidden">
                  <Edit3 className="size-4 text-primary" />
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Age</Label>
                  <Input type="number" value={age} onChange={e => setAge(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Member ID</Label>
                  <Input value={mid} onChange={e => setMid(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>House ID</Label>
                  <Input value={hid} onChange={e => setHid(e.target.value)} className="rounded-xl" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">Age</p>
                  <p className="font-semibold">{member.age ?? "—"} y</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Gender</p>
                  <p className="font-semibold">{member.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Member ID</p>
                  <p className="font-semibold">{member.memberId}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">House ID</p>
                  <p className="font-semibold">{member.houseId || "—"}</p>
                </div>
              </div>
            )}

            {member.dataIssues.length > 0 && !isEditing && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-2">
                <div className="size-5 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-rose-600 text-[10px] font-bold">!</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-800">Data Quality Issues Detected</p>
                  <p className="text-xs text-rose-700/80 mt-0.5">{member.dataIssues.join(" • ")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="ml-auto shrink-0 h-7 text-xs border-rose-200 text-rose-700 bg-white">
                  Fix Now
                </Button>
              </div>
            )}
          </div>

          {/* Clinical Readings History */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <History className="size-4 text-primary" /> Clinical Readings History
              </h2>
              <Link to="/assessments/$memberId" params={{ memberId: member.id }}>
                <Button size="sm" className="rounded-xl h-8">
                  <FileText className="size-3.5 mr-1.5" /> Assess
                </Button>
              </Link>
            </div>
            
            {!member.assessment ? (
              <div className="text-center p-6 bg-surface-muted/30 rounded-xl border border-dashed border-border/70">
                <p className="text-sm text-muted-foreground">No comprehensive screening found.</p>
                {member.systolic ? (
                  <p className="text-xs text-muted-foreground mt-1">Some vitals were provided during import.</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 p-3 bg-surface-muted/30 rounded-xl border border-border/50">
                  <div className="text-center">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Blood Pressure</p>
                    <p className="font-display text-lg font-bold mt-1">
                      {member.assessment.systolic ?? "-"}/{member.assessment.diastolic ?? "-"}
                    </p>
                  </div>
                  <div className="text-center border-l border-border/50">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Blood Sugar</p>
                    <p className="font-display text-lg font-bold mt-1">
                      {member.assessment.blood_sugar ?? "-"} <span className="text-xs font-normal text-muted-foreground">mg</span>
                    </p>
                  </div>
                  <div className="text-center border-l border-border/50">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Assessed</p>
                    <p className="font-medium text-xs mt-1.5">
                      {member.assessment.assessed_at ? new Date(member.assessment.assessed_at).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>
                {member.assessment.notes && (
                  <div className="text-xs text-muted-foreground p-3 bg-surface-muted/20 rounded-lg">
                    <span className="font-semibold text-foreground">Notes:</span> {member.assessment.notes}
                  </div>
                )}
                
                <div className="pt-2 border-t border-border/40">
                  <Button variant="outline" size="sm" className="w-full text-xs font-semibold" onClick={() => setShowLastFollowUp(true)}>
                    UPDATE LAST FOLLOW-UP DATE
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-4 space-y-5">
          {/* Risk Level */}
          <div className="card-surface p-5">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
              <Activity className="size-4 text-primary" /> Risk Profile
            </h2>
            <RiskBadge level={member.risk} className="w-full justify-center py-2 text-sm shadow-sm" />
            
            {member.riskReasons.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">Contributing Factors</p>
                {member.riskReasons.map((r, i) => (
                  <p key={i} className="text-xs font-medium text-foreground bg-surface-muted px-2 py-1.5 rounded-lg border border-border/50">
                    {r}
                  </p>
                ))}
              </div>
            )}

            {member.conditions.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">Known Conditions</p>
                <div className="flex flex-wrap gap-1.5">
                  {member.conditions.map((c, i) => (
                    <span key={i} className="text-[10px] font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-md">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Extra Fields */}
          {Object.keys(member.extraFields).length > 0 && (
            <div className="card-surface p-5">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                <FileText className="size-4 text-primary" /> Dynamic Fields
              </h2>
              <div className="space-y-3">
                {Object.entries(member.extraFields).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-start gap-2 text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground font-medium">{key}</span>
                    <span className="font-semibold text-right max-w-[60%] break-words">
                      {typeof val === 'object' ? JSON.stringify(val) : String(val || "—")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showLastFollowUp} onOpenChange={setShowLastFollowUp}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Last Follow-up Date</DialogTitle>
            <DialogDescription>
              Record a follow-up that occurred outside the application. This will preserve history and automatically calculate the next follow-up date.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Actual Date of Follow-up</Label>
              <Input 
                type="date" 
                max={new Date().toISOString().split('T')[0]} 
                value={lastFollowUpDate} 
                onChange={(e) => setLastFollowUpDate(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLastFollowUp(false)} disabled={isUpdatingFollowUp}>Cancel</Button>
            <Button onClick={handleUpdateLastFollowUp} disabled={!lastFollowUpDate || isUpdatingFollowUp}>
              {isUpdatingFollowUp ? "Updating..." : "Save & Calculate Next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
