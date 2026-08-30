import { Link } from "@tanstack/react-router";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { mapConfig } from "@/config/map";
import type { RiskLevel } from "@/config/risk";
import type { HouseView, MemberView } from "@/lib/domain";

const riskVar: Record<RiskLevel, string> = {
  low: "var(--risk-low)",
  moderate: "var(--risk-moderate)",
  high: "var(--risk-high)",
};

export default function HouseMap({ houses }: { houses: HouseView[] }) {
  const first = houses[0];
  const center: [number, number] = first
    ? [first.house.latitude!, first.house.longitude!]
    : mapConfig.defaultCenter;

  return (
    <MapContainer
      center={center}
      zoom={houses.length ? 14 : mapConfig.defaultZoom}
      className="size-full z-0"
      scrollWheelZoom
    >
      <TileLayer url={mapConfig.tileUrl} attribution={mapConfig.tileAttribution} />
      {houses.slice(0, mapConfig.maxPins).map((h) => (
        <CircleMarker
          key={h.house.id}
          center={[h.house.latitude!, h.house.longitude!]}
          radius={9}
          pathOptions={{
            color: riskVar[h.risk],
            fillColor: riskVar[h.risk],
            fillOpacity: 0.65,
            weight: 2,
          }}
        >
          <Popup className="custom-popup" maxWidth={350}>
            <div className="card-surface ios-glass border-none shadow-none space-y-3 p-1 max-h-[60vh] overflow-y-auto overflow-x-hidden">
              {/* House Header */}
              <div>
                <p className="font-display font-semibold text-lg text-foreground leading-tight">
                  {h.house.house_id ?? h.house.house_number ?? "Unnumbered house"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {h.house.address ?? "No address"}
                </p>
              </div>

              {/* House Stats */}
              <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                <span className="bg-surface-muted px-2 py-1 rounded-full">
                  {h.members.length} Members
                </span>
                <span className="bg-risk-high-soft text-risk-high px-2 py-1 rounded-full">
                  {h.counts.high} High
                </span>
                <span className="bg-risk-moderate-soft text-risk-moderate px-2 py-1 rounded-full">
                  {h.counts.moderate} Mod
                </span>
                <span className="bg-risk-low-soft text-risk-low px-2 py-1 rounded-full">
                  {h.counts.low} Low
                </span>
              </div>

              {/* Members List */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                  Members
                </p>
                {h.members.map((m) => (
                  <div
                    key={m.memberId}
                    className="bg-surface-muted rounded-xl p-3 text-xs space-y-1.5 border border-border/50"
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-sm text-foreground truncate max-w-[120px]">
                        {m.name}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          m.risk === "high"
                            ? "bg-risk-high text-white"
                            : m.risk === "moderate"
                              ? "bg-risk-moderate text-white"
                              : "bg-risk-low text-white"
                        }`}
                      >
                        {m.risk} risk
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {m.memberId} • {m.age ? `${m.age}y` : "?"} •{" "}
                      {m.gender?.charAt(0).toUpperCase() || "?"}
                    </p>

                    {/* Vitals Summary */}
                    {(m.systolic || m.bloodSugar) && (
                      <p className="text-muted-foreground font-mono bg-background/50 p-1 rounded-md inline-block">
                        BP: {m.systolic}/{m.diastolic} | BG: {m.bloodSugar || "-"}
                      </p>
                    )}

                    {/* Conditions Summary */}
                    {m.conditions && m.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.conditions.slice(0, 2).map((c) => (
                          <span
                            key={c}
                            className="bg-background px-1.5 py-0.5 border border-border/50 rounded-md text-[9px]"
                          >
                            {c}
                          </span>
                        ))}
                        {m.conditions.length > 2 && (
                          <span className="text-[9px] text-muted-foreground self-center">
                            +{m.conditions.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border/50 mt-2">
                <Link
                  to="/houses/$houseId"
                  params={{ houseId: h.house.id }}
                  className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl text-center flex-1 shadow-sm"
                >
                  View House
                </Link>
                <a
                  className="bg-surface-muted border border-border/50 text-foreground text-xs font-semibold px-3 py-2 rounded-xl text-center flex-1"
                  href={mapConfig.routeUrl(h.house.latitude!, h.house.longitude!)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Route
                </a>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
