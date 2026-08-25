import { Link } from "@tanstack/react-router";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import { mapConfig } from "@/config/map";
import type { RiskLevel } from "@/config/risk";
import type { HouseView } from "@/lib/domain";

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
      className="size-full"
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
          <Popup>
            <div className="space-y-1.5">
              <p className="font-semibold">
                {h.house.house_id ?? h.house.house_number ?? "Unnumbered house"}
              </p>
              <p className="text-xs">{h.house.address ?? "No address"}</p>
              <p className="text-xs">
                {h.members.length} members • {h.counts.high} high risk
              </p>
              <div className="flex gap-2 pt-1">
                <Link
                  to="/houses/$houseId"
                  params={{ houseId: h.house.id }}
                  className="text-xs font-semibold text-primary underline"
                >
                  Open
                </Link>
                <a
                  className="text-xs font-semibold text-primary underline"
                  href={mapConfig.routeUrl(h.house.latitude!, h.house.longitude!)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Navigate
                </a>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
