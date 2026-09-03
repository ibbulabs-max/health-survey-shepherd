import { useState } from "react";
import { SlidersHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useGlobalFilter } from "@/hooks/useGlobalFilter";
import { useAuth } from "@/hooks/useAuth";
import { useTeamTree } from "@/hooks/useTeamTree";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GlobalFilterSheet() {
  const { role, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const {
    eligibleOnly,
    setEligibleOnly,
    supervisorId,
    setSupervisorId,
    chwId,
    setChwId,
    resetRoleFilters,
  } = useGlobalFilter();
  const { data: teamTree } = useTeamTree();

  const isScopeSelectable = isAdmin || role === "supervisor";
  const hasActiveRoleFilter = Boolean(supervisorId || chwId);
  const scopeType = supervisorId ? "by_supervisor" : chwId ? "by_chw" : "all";

  const FilterContent = () => (
    <div className="space-y-6 py-4">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Data Scope
        </h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="eligible-toggle" className="text-sm font-medium flex flex-col gap-1">
            <span>Eligible Members Only</span>
            <span className="text-xs text-muted-foreground font-normal">
              Show only imported members marked as Eligible (≥30)
            </span>
          </Label>
          <Switch id="eligible-toggle" checked={eligibleOnly} onCheckedChange={setEligibleOnly} />
        </div>
      </div>

      {isScopeSelectable && (
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Role Filters
            </h3>
            {hasActiveRoleFilter && (
              <button
                onClick={resetRoleFilters}
                className="text-xs text-primary font-medium hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Filter By</Label>
              <Select
                value={scopeType}
                onValueChange={(val) => {
                  if (val === "all") resetRoleFilters();
                  if (val === "by_supervisor") setSupervisorId("any"); // Force open supervisor dropdown
                  if (val === "by_chw") setChwId("any");
                }}
              >
                <SelectTrigger className="w-full bg-surface">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="all">All Areas</SelectItem>}
                  {isAdmin && <SelectItem value="by_supervisor">By Supervisor</SelectItem>}
                  <SelectItem value="by_chw">By Health Worker (CHW)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scopeType === "by_supervisor" && isAdmin && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2">
                <Label className="text-xs text-muted-foreground">Select Supervisor</Label>
                <Select
                  value={supervisorId === "any" || !supervisorId ? "all_supervisors" : supervisorId}
                  onValueChange={(val) => setSupervisorId(val === "all_supervisors" ? null : val)}
                >
                  <SelectTrigger className="w-full bg-surface">
                    <SelectValue placeholder="All Supervisors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_supervisors">All Supervisors</SelectItem>
                    {teamTree?.supervisors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name ?? s.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scopeType === "by_chw" && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2">
                <Label className="text-xs text-muted-foreground">Select Health Worker</Label>
                <Select
                  value={chwId === "any" || !chwId ? "all_chws" : chwId}
                  onValueChange={(val) => setChwId(val === "all_chws" ? null : val)}
                >
                  <SelectTrigger className="w-full bg-surface">
                    <SelectValue placeholder="All Health Workers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_chws">All Health Workers</SelectItem>
                    {teamTree?.csws.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name ?? c.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 rounded-xl border-border/50 bg-card shadow-xs relative"
    >
      <SlidersHorizontal className="size-4 text-muted-foreground" />
      <span className="hidden sm:inline">Filters</span>
      {hasActiveRoleFilter && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-2 ring-background" />
      )}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="px-4 pb-8 max-h-[85vh]">
          <DrawerHeader className="px-0">
            <DrawerTitle className="font-display">Data Filters</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto">
            <FilterContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle className="font-display">Data Filters</SheetTitle>
        </SheetHeader>
        <FilterContent />
      </SheetContent>
    </Sheet>
  );
}
