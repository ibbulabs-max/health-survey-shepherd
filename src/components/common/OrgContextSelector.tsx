import React from "react";
import { Building2, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/db/client";

export function OrgContextSelector() {
  const { isMasterAdmin, selectedOrgId, setSelectedOrgId } = useAuth();

  const { data: orgs = [] } = useQuery({
    queryKey: ["all-organizations"],
    queryFn: async () => {
      // If an organizations table exists in Supabase, fetch from it;
      // otherwise provide default demonstration organizations or fallback
      const { data, error } = await supabase.from("organizations" as any).select("id, name");
      if (error || !data) {
        return [
          { id: "org-primary", name: "Primary Health NGO" },
          { id: "org-community-care", name: "Community Care Foundation" },
          { id: "org-rural-reach", name: "Rural Health Reach" },
        ];
      }
      return data as { id: string; name: string }[];
    },
    enabled: isMasterAdmin,
  });

  if (!isMasterAdmin) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs text-primary font-medium">
      <Building2 className="size-3.5 shrink-0" />
      <span className="font-semibold hidden sm:inline">Org Context:</span>
      <Select
        value={selectedOrgId ?? "all"}
        onValueChange={(val) => setSelectedOrgId(val === "all" ? null : val)}
      >
        <SelectTrigger className="h-7 border-0 bg-transparent px-2 py-0 text-xs font-semibold focus:ring-0 shadow-none text-primary hover:bg-primary/10 rounded-lg">
          <SelectValue placeholder="All Organizations (Global)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe className="size-3.5" /> All Organizations (Global)
            </span>
          </SelectItem>
          {orgs.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              <span className="flex items-center gap-1.5">
                <Building2 className="size-3.5" /> {org.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
