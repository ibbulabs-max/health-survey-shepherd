import { useState, useEffect } from "react";
import { LocateFixed, MapPin, Navigation, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { CircleMarker, MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PIN_CATALOG, getPinTypeConfig } from "@/config/pins";
import { mapConfig } from "@/config/map";
import { cn } from "@/lib/utils";

export interface HouseLocationPickerProps {
  houseId: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address: string;
  pinType: string;
  customType: string;
  onLocationChange: (lat: number | null, lng: number | null, accuracy: number | null) => void;
  onAddressChange: (address: string) => void;
  onPinTypeChange: (pinType: string) => void;
  onCustomTypeChange: (customType: string) => void;
}

function LocationMarkerHandler({
  position,
  onPositionChange,
}: {
  position: [number, number] | null;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });

  if (!position) return null;

  return (
    <CircleMarker
      center={position}
      radius={12}
      pathOptions={{
        color: "#007AFF",
        fillColor: "#007AFF",
        fillOpacity: 0.85,
        weight: 3,
      }}
    />
  );
}

export function HouseLocationPicker({
  houseId,
  latitude,
  longitude,
  accuracy,
  address,
  pinType,
  customType,
  onLocationChange,
  onAddressChange,
  onPinTypeChange,
  onCustomTypeChange,
}: HouseLocationPickerProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const currentCoords: [number, number] | null =
    latitude != null && longitude != null ? [latitude, longitude] : null;

  const defaultCenter = currentCoords ?? mapConfig.defaultCenter;

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by this device.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy ?? null;
        onLocationChange(lat, lng, acc);
        toast.success("GPS Location captured successfully!");
      },
      (err) => {
        setIsLocating(false);
        toast.error(`Could not obtain GPS location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const categories = [
    { id: "all", label: "All" },
    { id: "residential", label: "Residential" },
    { id: "commercial", label: "Commercial" },
    { id: "public", label: "Public / Religious" },
    { id: "infrastructure", label: "Infrastructure" },
    { id: "status", label: "Status" },
  ];

  const filteredPins = PIN_CATALOG.filter((p) => {
    if (selectedCategory === "all") return true;
    return p.category === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top House ID Header */}
      <div className="card-surface ios-glass p-4 rounded-2xl border border-primary/20 bg-primary-soft/30 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            House Location & Pin
          </span>
          <p className="font-display font-bold text-xl text-foreground mt-0.5">{houseId}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-xs font-semibold border border-border">
          <MapPin className="size-3.5 text-primary" />
          {latitude != null ? "GPS Pinned" : "Unpinned"}
        </div>
      </div>

      {/* Address / Location Name Input */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Address / Landmark / Location Name
        </Label>
        <Input
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="e.g. Near Community Center, House #14, Main Road"
          className="h-12 rounded-xl text-sm"
        />
      </div>

      {/* GPS Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <Button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={isLocating}
          className="h-12 flex-1 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm flex items-center justify-center gap-2"
        >
          <LocateFixed className={cn("size-4", isLocating && "animate-spin")} />
          {isLocating ? "Acquiring GPS Signal…" : "Use Current Location (GPS)"}
        </Button>
      </div>

      {/* Coordinates Display */}
      {latitude != null && longitude != null && (
        <div className="grid grid-cols-3 gap-2 text-center bg-surface-muted p-3 rounded-xl border border-border/50 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase">Latitude</span>
            <span className="font-mono font-semibold">{latitude.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase">Longitude</span>
            <span className="font-mono font-semibold">{longitude.toFixed(6)}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block uppercase">Accuracy</span>
            <span className="font-mono font-semibold">
              {accuracy ? `±${Math.round(accuracy)}m` : "GPS"}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Map Pin Picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Interactive Map Pin Placement
          </Label>
          <span className="text-[11px] text-muted-foreground">Tap map to place/move pin</span>
        </div>
        <div className="h-56 w-full rounded-2xl overflow-hidden border border-border/70 relative z-0 shadow-inner">
          <MapContainer
            center={defaultCenter}
            zoom={latitude != null ? 17 : 14}
            className="size-full"
            scrollWheelZoom
          >
            <TileLayer url={mapConfig.tileUrl} attribution={mapConfig.tileAttribution} />
            <LocationMarkerHandler
              position={currentCoords}
              onPositionChange={(lat, lng) => onLocationChange(lat, lng, null)}
            />
          </MapContainer>
        </div>
      </div>

      {/* WHAT IS PRESENT HERE? Feature / Pin Type */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            What is present here? (Pin Type)
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Select the physical feature or survey status at this location.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors shrink-0",
                selectedCategory === c.id
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-surface text-muted-foreground border-border hover:bg-surface-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Pin Type Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
          {filteredPins.map((p) => {
            const active = pinType === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPinTypeChange(p.id)}
                className={cn(
                  "p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all relative",
                  active
                    ? "bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30"
                    : "bg-surface text-foreground border-border/70 hover:bg-surface-muted",
                )}
              >
                <div
                  className="size-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                  style={{ backgroundColor: p.color }}
                >
                  <MapPin className="size-4 text-white" />
                </div>
                <span className="text-xs font-semibold truncate leading-tight">{p.label}</span>
                {active && <Check className="size-3.5 ml-auto text-primary shrink-0 stroke-[3]" />}
              </button>
            );
          })}
        </div>

        {/* Custom Feature Name if 'other' is selected */}
        {pinType === "other" && (
          <div className="space-y-1.5 pt-2 animate-in fade-in">
            <Label className="text-xs text-muted-foreground">Custom Feature Name</Label>
            <Input
              value={customType}
              onChange={(e) => onCustomTypeChange(e.target.value)}
              placeholder="e.g. Grain Storage / Water Well"
              className="h-11 rounded-xl text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
