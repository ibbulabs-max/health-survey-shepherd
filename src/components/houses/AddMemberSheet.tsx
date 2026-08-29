import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { tables } from "@/config/database";
import { supabase } from "@/db/client";
import { generateMemberId } from "@/services/houseService";
import { useRefreshDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";

interface AddMemberSheetProps {
  houseUuid: string;
  houseId: string | null;
  currentMembers30Plus: number;
}

export function AddMemberSheet({ houseUuid, houseId, currentMembers30Plus }: AddMemberSheetProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [gender, setGender] = useState("");
  const { user } = useAuth();
  const refresh = useRefreshDataset();

  const is30Plus = parseInt(age, 10) >= 30;

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (!age || isNaN(Number(age))) throw new Error("Valid age is required");
      if (!gender) throw new Error("Gender is required");

      const newMemberId = is30Plus && houseId ? generateMemberId(houseId, currentMembers30Plus + 1) : null;

      const { data, error } = await supabase
        .from(tables.houseMembers)
        .insert({
          house_uuid: houseUuid,
          member_id: newMemberId,
          member_name: name.trim(),
          data: {
            name: name.trim(),
            age: parseInt(age, 10),
            gender,
            eligible: is30Plus,
            house_id: houseId
          },
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Member added successfully");
      setOpen(false);
      setName("");
      setAge("");
      setGender("");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add member")
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="rounded-xl font-semibold shadow-xs bg-primary text-white">
          <UserPlus className="size-4 mr-1.5" />
          Add Member
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] sm:h-auto sm:max-h-[85vh] sm:rounded-l-3xl sm:rounded-tr-none sm:top-0 sm:right-0 sm:bottom-0 sm:w-96 sm:max-w-md">
        <SheetHeader className="text-left mb-6 relative">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="font-display text-xl font-bold">Add Household Member</SheetTitle>
              <SheetDescription className="mt-1">
                Enter details for the new member. Members 30 and older will automatically be assigned a unique Member ID.
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full size-8 shrink-0 absolute right-0 top-0"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Age</Label>
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Years"
                className="rounded-xl"
                min={0}
                max={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {age && is30Plus && houseId ? (
            <div className="card-surface p-3 border border-primary/20 bg-primary/5 rounded-xl mt-4">
              <p className="text-sm font-medium text-primary flex items-center gap-2">
                <UserPlus className="size-4" />
                Eligible for Screening (30+)
              </p>
              <p className="text-xs text-primary/70 mt-1">
                This member will automatically be assigned an ID like {generateMemberId(houseId, currentMembers30Plus + 1)}
              </p>
            </div>
          ) : age && !is30Plus ? (
            <div className="card-surface p-3 border border-border bg-surface-muted rounded-xl mt-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Under 30
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This member is not eligible for regular screening and will not receive a dedicated ID.
              </p>
            </div>
          ) : null}

          <div className="pt-4">
            <Button
              className="w-full rounded-xl"
              onClick={() => add.mutate()}
              disabled={add.isPending}
            >
              {add.isPending ? "Adding..." : "Save Member"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
