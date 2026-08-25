import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, LocateFixed, Navigation, Stethoscope } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { RiskBadge } from "@/components/common/RiskBadge";
import { ScreeningDialog } from "@/components/screening/ScreeningDialog";
import { Button } from "@/components/ui/button";
import { mapConfig } from "@/config/map";
import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import type { MemberView } from "@/lib/domain";
import { updateHouseLocation } from "@/services/screeningService";

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
        property: "og:description",
        content: "Members, vitals, risk and follow-up history for a single household.",
      },
    ],
  }),
  component: HouseDetailPage,
});

function HouseDetailPage() {
  const { houseId } = Route.useParams();
  const { data, isLoading, error, refetch } = useDataset();
  const refresh = useRefreshDataset();
  const [screening, setScreening] = useState<MemberView | null>(null);

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

  const house = data?.byHouseUuid.get(houseId);
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

  return (
    <div className="space-y-5">
      <Link
        to="/houses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
      >
        <ArrowLeft className="size-4" /> Households
      </Link>

      <PageHeader
        title={house.house.house_id ?? house.house.house_number ?? "Unnumbered house"}
        subtitle={house.house.address ?? "No address recorded"}
        actions={
          <>
            {house.hasLocation ? (
              <Button asChild variant="secondary" className="rounded-xl">
                <a
                  href={mapConfig.routeUrl(house.house.latitude!, house.house.longitude!)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="size-4" /> Navigate
                </a>
              </Button>
            ) : null}
            <Button
              className="rounded-xl"
              disabled={locate.isPending}
              onClick={() => locate.mutate()}
            >
              <LocateFixed className="size-4" />
              {locate.isPending ? "Locating…" : house.hasLocation ? "Update pin" : "Pin location"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Info label="Owner" value={house.house.owner_name ?? "—"} />
        <Info label="Members" value={`${house.members.length}`} />
        <Info label="Eligible (30+)" value={`${house.eligible}`} />
        <Info label="Screened" value={`${house.screened}`} />
      </div>

      <div className="card-surface flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium">Household risk</p>
          <p className="text-xs text-muted-foreground">
            {house.counts.high} high • {house.counts.moderate} moderate • {house.counts.low} low
          </p>
        </div>
        <RiskBadge level={house.risk} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">Members</h2>
        {house.members.length === 0 ? (
          <EmptyState title="No members recorded" description="Import member rows for this household." />
        ) : (
          <div className="grid gap-2">
            {house.members.map((member) => (
              <div key={member.id} className="card-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.memberId} • {member.age != null ? `${member.age}y` : "Age unknown"} •{" "}
                      {member.gender ?? "Gender unknown"}
                    </p>
                  </div>
                  <RiskBadge level={member.risk} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Reading label="BP" value={member.systolic && member.diastolic ? `${member.systolic}/${member.diastolic}` : "—"} />
                  <Reading label="Sugar" value={member.bloodSugar != null ? `${member.bloodSugar}` : "—"} />
                  <Reading label="Conditions" value={`${member.conditions.length}`} />
                </div>

                {member.conditions.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {member.conditions.join(" • ")}
                  </p>
                ) : null}

                {member.dataIssues.length ? (
                  <p className="mt-2 rounded-lg bg-risk-moderate-soft px-3 py-2 text-[11px] font-medium text-risk-moderate">
                    {member.dataIssues.join(" • ")}
                  </p>
                ) : null}

                {Object.keys(member.extraFields).length ? (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium text-primary">
                      Imported extra fields ({Object.keys(member.extraFields).length})
                    </summary>
                    <dl className="mt-2 grid grid-cols-2 gap-1">
                      {Object.entries(member.extraFields).map(([key, value]) => (
                        <div key={key} className="truncate">
                          <dt className="inline font-medium text-foreground">{key}: </dt>
                          <dd className="inline">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {member.screenedAt
                      ? `Last screened ${new Date(member.screenedAt).toLocaleDateString()}`
                      : "Not screened yet"}
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => setScreening(member)}
                  >
                    <Stethoscope className="size-4" /> Screen
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">Follow-up history</h2>
        {followUps.length === 0 ? (
          <EmptyState title="No follow-ups yet" description="They are created automatically after each screening." />
        ) : (
          <div className="grid gap-2">
            {followUps
              .slice()
              .sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""))
              .map((f) => (
                <div key={f.id} className="card-surface flex items-center justify-between p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{f.reason ?? "Follow-up"}</p>
                    <p className="text-xs text-muted-foreground">Due {f.due_date ?? "—"}</p>
                  </div>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {f.status ?? "due"}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      {screening ? (
        <ScreeningDialog
          member={screening}
          houseUuid={houseId}
          open
          onOpenChange={(open) => !open && setScreening(null)}
        />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-3.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-medium">{value}</p>
    </div>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-2 py-2">
      <p className="font-display text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
    </div>
  );
}
