import { useMemo, useState } from "react";
import { SharedMap } from "@/components/map/SharedMap";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";
import type { HouseView } from "@/lib/domain";
import type { Pin } from "@/lib/pin-types";
import type { RiskLevel, ClinicalRiskState } from "@/config/risk";

export default function HouseMap({ houses }: { houses: HouseView[] }) {
  const [activeHouse, setActiveHouse] = useState<HouseView | null>(null);

  const pins: Pin[] = useMemo(() => {
    const list: Pin[] = [];
    for (const h of houses) {
      if (!h.hasLocation || h.house.latitude == null || h.house.longitude == null) continue;
      list.push({
        id: h.house.id,
        user_id: h.house.mapped_by || "",
        username: h.house.mapped_by || "",
        latitude: h.house.latitude,
        longitude: h.house.longitude,
        accuracy: null,
        pin_type: h.house.pin_type || "house",
        custom_type: null,
        house_id: h.house.house_id,
        house_number: h.house.house_number,
        owner_name: h.house.owner_name,
        notes: null,
        device_time: null,
        device_id: null,
        created_at: h.house.created_at || "",
        updated_at: h.house.created_at || "",
      });
    }
    return list;
  }, [houses]);

  const riskByHouse = useMemo(() => {
    const out: Record<string, ClinicalRiskState> = {};
    for (const h of houses) {
      if (h.house.house_id) {
        out[h.house.house_id.trim().toUpperCase()] = h.risk;
      }
    }
    return out;
  }, [houses]);

  const handleSelect = (pin: Pin) => {
    const found = houses.find((h) => h.house.id === pin.id);
    if (found) {
      setActiveHouse(found);
    }
  };

  const centerCoords = useMemo(() => {
    const first = houses.find((h) => h.hasLocation);
    if (first && first.house.latitude && first.house.longitude) {
      return { lat: first.house.latitude, lng: first.house.longitude, id: first.house.id };
    }
    return null;
  }, [houses]);

  return (
    <div className="relative size-full">
      <SharedMap
        pins={pins}
        showPins={true}
        position={null}
        heading={null}
        draft={null}
        focus={centerCoords}
        addMode={false}
        editMode={false}
        riskByHouse={riskByHouse}
        canMove={() => false}
        onMapTap={() => {}}
        onDraftMove={() => {}}
        onSelectPin={handleSelect}
        onSelectMany={(pins) => handleSelect(pins[0]!)}
        onPinDragged={() => {}}
      />
      {activeHouse && (
        <HouseDetailSheet
          house={activeHouse}
          open={!!activeHouse}
          onOpenChange={(open) => !open && setActiveHouse(null)}
        />
      )}
    </div>
  );
}
