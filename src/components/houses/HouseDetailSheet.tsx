import { Link } from "@tanstack/react-router";
import { Navigation, MapPin, Stethoscope, ChevronRight, Home, Share, Pencil } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Button } from "@/components/ui/button";
import { mapConfig } from "@/config/map";
import type { HouseView, MemberView } from "@/lib/domain";
import { cn } from "@/lib/utils";

export interface HouseDetailSheetProps {
  house: HouseView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddLocation?: (houseId: string) => void;
}

import { useAuth } from "@/hooks/useAuth";

/**
 * Single Source of Truth: Reusable Global House Detail Card / Bottom Sheet.
 * Extracted and unified from the Map House Card for 100% consistent UX everywhere.
 */
export function HouseDetailSheet({
  house,
  open,
  onOpenChange,
  onAddLocation,
}: HouseDetailSheetProps) {
  const { can } = useAuth();

  if (!house) return null;

  const houseIdDisplay = house.house.house_id ?? house.house.house_number ?? "Unnumbered House";
  const addressDisplay = house.house.address ?? "No address recorded";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-lg mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-2xl shadow-2xl">
        <div className="px-5 pb-8 pt-2 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* iOS Drag Handle */}
          <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />

          {/* House Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary block">
                Household Details
              </span>
              <h3 className="font-display font-bold text-xl text-foreground truncate mt-0.5">
                {houseIdDisplay}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{addressDisplay}</p>
            </div>
            <RiskBadge level={house.risk} />
          </div>

          {/* House Quick Metrics Summary */}
          <div className="grid grid-cols-4 gap-2 text-center bg-surface-muted p-2.5 rounded-2xl border border-border/50 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground block uppercase font-medium">
                Members
              </span>
              <span className="font-bold font-mono text-sm text-foreground">
                {house.members.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-risk-high block uppercase font-medium">High</span>
              <span className="font-bold font-mono text-sm text-risk-high">
                {house.counts.high}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-risk-moderate block uppercase font-medium">
                Mod
              </span>
              <span className="font-bold font-mono text-sm text-risk-moderate">
                {house.counts.moderate}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-risk-normal block uppercase font-medium">
                normal
              </span>
              <span className="font-bold font-mono text-sm text-risk-normal">
                {house.counts.low}
              </span>
            </div>
          </div>

          {/* Household Members List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Household Members ({house.members.length})
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {house.eligible} eligible (30+) • {house.screened} screened
              </span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {house.members.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface border border-border/50 text-center text-xs text-muted-foreground">
                  No members recorded for this household.
                </div>
              ) : (
                house.members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-surface border border-border/70 flex items-center justify-between text-xs transition-colors hover:border-primary/40 shadow-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-foreground truncate">{m.name}</p>
                      <p className="text-[10.5px] text-muted-foreground font-mono">
                        {m.memberId && m.memberId !== "—" ? m.memberId : "Under 30"} •{" "}
                        {m.age != null ? `Age ${m.age}` : "Age ?"} • {m.gender || "?"}
                      </p>
                      {m.systolic && m.diastolic ? (
                        <p className="text-[10px] font-mono text-primary mt-0.5 font-medium">
                          BP: {m.systolic}/{m.diastolic} | Sugar: {m.bloodSugar ?? "—"}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <RiskBadge level={m.risk} />
                      {m.eligible ? (
                        can("perform_assessment") || m.screenedAt ? (
                          <div className="flex gap-1.5 mt-1">
                            <Link
                              to="/members/$memberId"
                              params={{ memberId: m.id }}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground hover:underline bg-surface-muted px-2 py-0.5 rounded-md border border-border/50"
                            >
                              Profile
                            </Link>
                            <Link
                              to="/assessments/$memberId"
                              params={{ memberId: m.id }}
                              onClick={() => onOpenChange(false)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline bg-primary-soft/50 px-2 py-0.5 rounded-md"
                            >
                              <Stethoscope className="size-2.5" />
                              {m.screenedAt
                                ? can("perform_assessment")
                                  ? "Re-Assess"
                                  : "View"
                                : "Assess"}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-[9.5px] text-muted-foreground mt-1 block">
                            Pending Assessment
                          </span>
                        )
                      ) : (
                        <span className="text-[9.5px] text-muted-foreground">Under 30</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            {can("perform_assessment") && (
              <Button
                asChild
                className="w-full rounded-xl font-semibold bg-primary text-white shadow-xs"
                onClick={() => onOpenChange(false)}
              >
                <Link to="/survey/new" search={{ houseId: house.house.id }}>
                  <Stethoscope className="size-4 mr-1.5" />
                  Add Assessment / Survey
                </Link>
              </Button>
            )}

            {!house.hasLocation ? (
              <div className="rounded-xl border border-dashed border-destructive/50 bg-destructive/5 p-3 flex flex-col items-center justify-center gap-2 text-center mt-2">
                <span className="text-[11px] font-bold tracking-widest text-destructive uppercase flex items-center gap-1.5">
                  House Not Mapped
                </span>
                <Button
                  asChild={!onAddLocation}
                  className="w-full rounded-xl font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-none border border-destructive/20"
                  onClick={() => {
                    if (onAddLocation) {
                      onAddLocation(house.house.id);
                    } else {
                      onOpenChange(false);
                    }
                  }}
                >
                  {onAddLocation ? (
                    <button type="button">
                      <MapPin className="size-4 mr-1.5" /> Map House
                    </button>
                  ) : (
                    <Link to="/map" search={{ houseId: house.house.id, locate: true }}>
                      <MapPin className="size-4 mr-1.5" /> Add Location on Map
                    </Link>
                  )}
                </Button>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 mt-2">
              <Button
                asChild
                variant="outline"
                className="rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
                onClick={() => onOpenChange(false)}
              >
                <Link to="/map" search={{ houseId: house.house.id }}>
                  <MapPin className="size-4" /> Open on Map
                </Link>
              </Button>

              {house.hasLocation ? (
                <a
                  href={mapConfig.routeUrl(house.house.latitude!, house.house.longitude!)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-border bg-surface text-foreground font-semibold flex items-center justify-center gap-1.5 text-sm shadow-xs hover:bg-surface-muted transition-colors h-9 px-4"
                >
                  <Navigation className="size-4" /> Navigate
                </a>
              ) : (
                <Button variant="outline" disabled className="rounded-xl font-semibold opacity-50">
                  <Navigation className="size-4 mr-1.5" /> Navigate
                </Button>
              )}

              <Button
                variant="outline"
                className="rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: `House ${houseIdDisplay}`,
                        text: `View location for House ${houseIdDisplay}`,
                        url: window.location.href,
                      })
                      .catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
              >
                <Share className="size-4" /> Share
              </Button>

              <Button
                asChild
                variant="outline"
                className="rounded-xl font-semibold shadow-xs flex items-center gap-1.5"
                onClick={() => onOpenChange(false)}
              >
                <Link to="/houses/$houseId" params={{ houseId: house.house.id }}>
                  <Pencil className="size-4" /> Edit
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Re-export alias
export const HouseDetailCard = HouseDetailSheet;
