import { Plus, Trash2, User, UserCheck, ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CreateHouseMemberInput } from "@/services/houseService";
import { generateMemberId } from "@/services/houseService";

import { cn } from "@/lib/utils";

export interface MemberSlotListProps {
  houseId: string;
  members: CreateHouseMemberInput[];
  onMembersChange: (members: CreateHouseMemberInput[]) => void;
}

export function MemberSlotList({ houseId, members, onMembersChange }: MemberSlotListProps) {
  const minEligibleAge = 30;

  const handleUpdateMember = (index: number, updates: Partial<CreateHouseMemberInput>) => {
    const updated = [...members];
    const current = updated[index];
    if (!current) return;
    updated[index] = { ...current, ...updates };
    onMembersChange(updated);
  };

  const handleAddMember = () => {
    onMembersChange([
      ...members,
      {
        name: "",
        age: null,
        gender: "Male",
      },
    ]);
  };

  const handleRemoveMember = (index: number) => {
    const updated = members.filter((_, i) => i !== index);
    onMembersChange(updated);
  };

  // Compute 30+ indexing for Member IDs
  let count30Plus = 0;
  const computedMemberIds = members.map((m) => {
    if (m.age != null && m.age >= minEligibleAge) {
      count30Plus++;
      return generateMemberId(houseId, count30Plus);
    }
    return null;
  });

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="flex items-center justify-between pb-1 border-b border-border/50">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Household Members ({members.length})
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {count30Plus} member(s) eligible for 30+ health assessment.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAddMember}
          variant="outline"
          size="sm"
          className="h-8 text-xs font-semibold rounded-xl text-primary border-primary/30"
        >
          <Plus className="size-3.5 mr-1" /> Add Member
        </Button>
      </div>

      {/* Member Cards */}
      <div className="space-y-3">
        {members.map((member, index) => {
          const is30Plus = member.age != null && member.age >= minEligibleAge;
          const assignedMemberId = computedMemberIds[index];

          return (
            <div
              key={index}
              className={cn(
                "card-surface p-4 rounded-2xl border transition-all space-y-3.5 relative",
                is30Plus ? "border-primary/30 bg-primary-soft/10" : "border-border/70",
              )}
            >
              {/* Member Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "size-7 rounded-xl flex items-center justify-center text-xs font-bold font-mono",
                      is30Plus ? "bg-primary text-white" : "bg-surface-muted text-muted-foreground",
                    )}
                  >
                    #{index + 1}
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-foreground">
                      {member.name.trim() || `Member ${index + 1}`}
                    </span>
                    {assignedMemberId ? (
                      <span className="block font-mono text-[10.5px] font-bold text-primary">
                        ID: {assignedMemberId}
                      </span>
                    ) : (
                      <span className="block text-[10px] text-muted-foreground">
                        {member.age != null ? "Under 30 (No ID)" : "Enter age to check eligibility"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {is30Plus && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      30+ Eligible
                    </span>
                  )}
                  {members.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMember(index)}
                      className="size-7 rounded-lg text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Name */}
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-[11px] text-muted-foreground">Full Name *</Label>
                  <Input
                    value={member.name}
                    onChange={(e) => handleUpdateMember(index, { name: e.target.value })}
                    placeholder="Enter full name"
                    className="h-10 rounded-xl text-sm"
                  />
                </div>

                {/* Age */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Age (Years) *</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={member.age != null ? String(member.age) : ""}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      handleUpdateMember(index, { age: val });
                    }}
                    placeholder="e.g. 35"
                    className="h-10 rounded-xl text-sm text-center font-mono font-semibold"
                  />
                </div>

                {/* Gender (Normalized: Male, Female, Other) */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Gender *</Label>
                  <ToggleGroup
                    type="single"
                    value={member.gender}
                    onValueChange={(v) => {
                      if (v) handleUpdateMember(index, { gender: v as any });
                    }}
                    className="justify-start bg-surface-muted p-0.5 rounded-xl border border-border/50 h-10 w-full"
                  >
                    <ToggleGroupItem
                      value="Male"
                      className="rounded-lg flex-1 text-xs font-semibold"
                    >
                      Male
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Female"
                      className="rounded-lg flex-1 text-xs font-semibold"
                    >
                      Female
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="Other"
                      className="rounded-lg flex-1 text-xs font-semibold"
                    >
                      Other
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>

              {/* Optional Phone & Occupation */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Mobile Phone</Label>
                  <Input
                    type="tel"
                    value={member.phone ?? ""}
                    onChange={(e) => handleUpdateMember(index, { phone: e.target.value })}
                    placeholder="10-digit number"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Occupation</Label>
                  <Input
                    value={member.occupation ?? ""}
                    onChange={(e) => handleUpdateMember(index, { occupation: e.target.value })}
                    placeholder="e.g. Farmer / Homemaker"
                    className="h-9 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
