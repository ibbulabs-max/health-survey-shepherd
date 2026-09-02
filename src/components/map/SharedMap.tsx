import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

import { useGeolocation, type GeoPosition } from "@/hooks/useGeolocation";
import type { Pin } from "@/lib/pin-types";
import type { RiskLevel, ClinicalRiskState } from "@/config/risk";

const LeafletMap = lazy(() => import("@/components/map/LeafletMap"));

type SharedMapProps = {
  pins: Pin[];
  showPins: boolean;
  position: GeoPosition | null;
  heading: number | null;
  draft: { lat: number; lng: number } | null;
  focus: { lat: number; lng: number } | null;
  addMode: boolean;
  editMode: boolean;
  riskByHouse?: Record<string, ClinicalRiskState> | undefined;
  route?: { lat: number; lng: number }[] | undefined;
  canMove: (pin: Pin) => boolean;
  onMapTap: (latlng: { lat: number; lng: number }) => void;
  onDraftMove: (latlng: { lat: number; lng: number }) => void;
  onSelectPin: (pin: Pin) => void;
  onSelectMany: (pins: Pin[]) => void;
  onPinDragged: (pin: Pin, latlng: { lat: number; lng: number }) => void;
};

export function SharedMap(props: SharedMapProps) {
  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center bg-muted">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <LeafletMap {...props} />
    </Suspense>
  );
}
