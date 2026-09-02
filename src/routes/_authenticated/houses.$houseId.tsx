import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  LocateFixed,
  Navigation,
  Stethoscope,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { FileText, CalendarCheck2, PencilLine, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { Button } from "@/components/ui/button";
import { mapConfig } from "@/config/map";
import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { useAuth } from "@/hooks/useAuth";
import { followUpStatus, type MemberView } from "@/lib/domain";
import { updateHouseLocation } from "@/services/screeningService";
import { getPinTypeConfig } from "@/config/pins";
import { AddMemberSheet } from "@/components/houses/AddMemberSheet";

export const Route = createFileRoute("/_authenticated/houses/$houseId")({
  head: () => ({
    meta: [
      { title: "Household detail — Management App by Ibrahim Labs" },
      {
        name: "description",
        content:
          "Household members, exact vitals, derived risk, GPS location and follow-up history in one place.",
      },
      { property: "og:title", content: "Household detail — Management App" },
      {
        name: "og:description",
        content: "Members, vitals, risk and follow-up history for a single household.",
      },
    ],
  }),
  component: HouseDetailPage,
});

function HouseDetailPage() {
  const { houseId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useDataset();
  const refresh = useRefreshDataset();
  const { role, can } = useAuth();
  const isCHW = role === "survey_user" || role === "admin" || role === "super_admin";

  const allHouses = useMemo(() => data?.houses ?? [], [data]);
  const currentIndex = allHouses.findIndex((h) => h.house.id === houseId);
  const prevHouse = currentIndex > 0 ? allHouses[currentIndex - 1] : null;
  const nextHouse =
    currentIndex >= 0 && currentIndex < allHouses.length - 1 ? allHouses[currentIndex + 1] : null;

  const house = data?.byHouseUuid.get(houseId);

  const locate = useMutation({
    mutationFn: async () => {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("This device can't share its location."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
        });
      });
      await updateHouseLocation(
        houseId,
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy ?? null,
      );
    },
    onSuccess: () => {
      toast.success("Location pinned to this household.");
      void refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not get location."),
  });

  if (isLoading) return <LoadingState label="Loading household…" />;
  if (error)
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Unknown error"}
        onRetry={() => void refetch()}
      />
    );

  if (!house)
    return (
      <EmptyState
        title="Household not found"
        description="It may have been removed, or you don't have access to it."
        action={
          <Button asChild variant="secondary" className="rounded-xl">
            <Link to="/houses">Back to households</Link>
          </Button>
        }
      />
    );

  const followUps = (data?.followUps ?? []).filter((f) => f.house_uuid === houseId);
  const pinConfig = getPinTypeConfig(house.house.pin_type);

  return (
    <div className="space-y-5 pb-12">
      {/* Top Breadcrumb & Next/Prev Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/houses"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" /> Households
        </Link>
        <div className="flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            disabled={!prevHouse}
            className="rounded-xl h-8 px-2 text-xs"
          >
            {prevHouse ? (
              <Link to="/houses/$houseId" params={{ houseId: prevHouse.house.id }}>
                <ChevronLeft className="size-4 mr-0.5" /> Prev
              </Link>
            ) : (
              <span>
                <ChevronLeft className="size-4 mr-0.5" /> Prev
              </span>
            )}
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            disabled={!nextHouse}
            className="rounded-xl h-8 px-2 text-xs"
          >
            {nextHouse ? (
              <Link to="/houses/$houseId" params={{ houseId: nextHouse.house.id }}>
                Next <ChevronRight className="size-4 ml-0.5" />
              </Link>
            ) : (
              <span>
                Next <ChevronRight className="size-4 ml-0.5" />
              </span>
            )}
          </Button>
        </div>
      </div>

      <PageHeader
        title={house.house.house_id ?? house.house.house_number ?? "Unnumbered house"}
        subtitle={house.house.address ?? "No address recorded"}
        actions={
          <div className="flex items-center gap-2">
            {house.hasLocation ? (
              <Button asChild className="rounded-xl font-semibold shadow-xs bg-primary text-white">
                <Link to="/map" search={{ houseId: house.house.id }}>
                  <MapPin className="size-4 mr-1.5" /> Go to this Pin
                </Link>
              </Button>
            ) : null}
            <Button
              variant={house.hasLocation ? "secondary" : "default"}
              className="rounded-xl font-semibold shadow-xs"
              disabled={locate.isPending}
              onClick={() => locate.mutate()}
            >
              <LocateFixed className="size-4 mr-1.5" />
              {locate.isPending ? "Locating…" : house.hasLocation ? "Update Pin" : "Add House Pin"}
            </Button>
          </div>
        }
      />

      {/* Quick Overview Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Info
          label="Housing Type"
          value={(house.house.data?.["housing_type"] as string) || "Pakka"}
        />
        <Info label="Total Members" value={`${house.members.length}`} />
        <Info label="Eligible (30+)" value={`${house.eligible}`} />
        <Info label="Screened" value={`${house.screened} of ${house.eligible}`} />
      </div>

      {/* Feature & Risk Status */}
      <div className="card-surface p-4 rounded-2xl flex items-center justify-between border border-border/70">
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
            style={{ backgroundColor: pinConfig.color }}
          >
            <MapPin className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{pinConfig.label}</p>
            <p className="text-xs text-muted-foreground">
              {house.counts.high} High • {house.counts.moderate} Mod • {house.counts.low} Low
              Risk
            </p>
          </div>
        </div>
        <RiskBadge level={house.risk} />
      </div>

      {/* Members Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-foreground">
            Household Members ({house.members.length})
          </h2>
          {isCHW && (
            <AddMemberSheet
              houseUuid={house.house.id}
              houseId={house.house.house_id}
              currentMembers30Plus={
                house.members.filter((m) => m.eligible).length
              }
            />
          )}
        </div>

        {house.members.length === 0 ? (
          <EmptyState title="No members recorded" description="Add members to this household." />
        ) : (
          <div className="grid gap-2.5">
            {house.members.map((member) => (
              <div
                key={member.id}
                className="card-surface p-4 rounded-2xl border border-border/70 space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-base text-foreground">{member.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {member.memberId} • {member.age != null ? `${member.age}y` : "Age unknown"} •{" "}
                      {member.gender ?? "Gender unknown"}
                    </p>
                  </div>
                  <RiskBadge level={member.risk} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <Reading
                    label="BP (mmHg)"
                    value={
                      member.systolic && member.diastolic
                        ? `${member.systolic}/${member.diastolic}`
                        : "—"
                    }
                  />
                  <Reading
                    label="Sugar (mg/dL)"
                    value={member.bloodSugar != null ? `${member.bloodSugar}` : "—"}
                  />
                  <Reading label="Conditions" value={`${member.conditions.length}`} />
                </div>

                {member.conditions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Known:{" "}
                    <span className="font-medium text-foreground">
                      {member.conditions.join(", ")}
                    </span>
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground">
                    {member.screenedAt
                      ? `Screened: ${new Date(member.screenedAt).toLocaleDateString()}`
                      : member.eligible
                        ? "Screening Pending"
                        : "Under 30 (Not eligible)"}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 px-3 text-xs font-semibold shadow-xs"
                    >
                      <Link to="/members/$memberId" params={{ memberId: member.id }}>
                        Profile
                      </Link>
                    </Button>
                    {member.eligible && (can("perform_assessment") || member.screenedAt) && (
                      <Button
                        asChild
                        size="sm"
                        className="rounded-xl h-8 px-3 font-semibold bg-primary text-white shadow-xs"
                      >
                        <Link to="/assessments/$memberId" params={{ memberId: member.id }}>
                          <Stethoscope className="size-3.5 mr-1.5" />
                          {member.screenedAt
                            ? can("perform_assessment")
                              ? "Re-Assess"
                              : "View"
                            : "Assess"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Follow-up History */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-foreground">
          Follow-up Schedule & History
        </h2>
        {followUps.length === 0 ? (
          <EmptyState
            title="No follow-ups recorded"
            description="Follow-ups are scheduled automatically when assessments are completed."
          />
        ) : (
          <div className="grid gap-2">
            {followUps
              .slice()
              .sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""))
              .map((f) => (
                <div
                  key={f.id}
                  className="card-surface flex items-center justify-between p-3.5 rounded-2xl border border-border/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {f.reason ?? "Routine Follow-up"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Due Date: {f.due_date ?? "—"}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold capitalize text-muted-foreground border border-border/50">
                    {followUpStatus(f.status, f.due_date)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-3.5 rounded-2xl border border-border/70">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="mt-1 truncate font-display font-bold text-base text-foreground">{value}</p>
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-2 py-2 border border-border/50">
      <p className="font-display text-sm font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
