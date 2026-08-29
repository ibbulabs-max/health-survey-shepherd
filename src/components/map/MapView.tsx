import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  MapPin,
  Eye,
  EyeOff,
  RotateCcw,
  LocateFixed,
  Plus,
  Edit2,
  ChevronDown,
  Navigation,
  Compass,
  X,
  Home,
  Check,
  Building2,
  Store,
  Sparkles,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { PIN_CATALOG, getPinTypeConfig, type PinTypeConfig } from "@/config/pins";
import { mapConfig } from "@/config/map";
import type { HouseView, MemberView } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";
import { POIDetailSheet } from "@/components/houses/POIDetailSheet";
import { PinSheet } from "@/components/map/PinSheet";
import { HouseIdBuilder } from "@/components/houses/HouseIdBuilder";
import { useRefreshDataset } from "@/hooks/useDataset";
import { createStandalonePin, linkExistingHouseLocation } from "@/services/houseService";
import { cn } from "@/lib/utils";
import MarkerClusterGroup from "react-leaflet-cluster";

// 1. Create SVG Leaflet DivIcon for Pins (Teardrop shape with white category icon & risk color)
function createCustomPinIcon(
  pinType: string,
  riskLevel?: string,
  badgeNumber?: number | string
): L.DivIcon {
  const cfg = getPinTypeConfig(pinType);
  
  // House pin color represents the calculated household risk:
  // High = Red (#EF4444), Moderate = Orange (#F59E0B), Low = Green (#10B981)
  let color = cfg.color;
  if (cfg.id === "house") {
    if (riskLevel === "high") color = "#EF4444";
    else if (riskLevel === "moderate") color = "#F59E0B";
    else if (riskLevel === "low") color = "#10B981";
  }

  let iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
  
  if (cfg.id === "locked_house") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  } else if (cfg.id === "refused") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
  } else if (cfg.id === "shop" || cfg.id === "restaurant") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`;
  } else if (cfg.id === "empty_land" || cfg.id === "park") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></svg>`;
  } else if (cfg.id === "hospital") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`;
  } else if (cfg.id === "school" || cfg.id === "college") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>`;
  } else if (cfg.id === "mosque" || cfg.id === "temple" || cfg.id === "church") {
    iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V9l7-6 7 6v12"/><path d="M9 21v-4a3 3 0 0 1 6 0v4"/></svg>`;
  }

  const badgeHtml =
    badgeNumber !== undefined
      ? `<div style="position:absolute; top:-4px; right:-6px; background:white; color:#1c1c1e; font-size:9px; font-weight:800; font-family:monospace; border-radius:9999px; width:16px; height:16px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.3); border:1.5px solid ${color};">${badgeNumber}</div>`
      : "";

  const html = `
    <div style="position:relative; width:34px; height:42px; transform:translate(-50%, -100%); cursor:pointer;">
      <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.25));">
        <path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 42 17 42C17 42 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="${color}"/>
        <circle cx="17" cy="17" r="13" fill="white" fill-opacity="0.2"/>
      </svg>
      <div style="position:absolute; top:7px; left:10px; width:14px; height:14px; display:flex; align-items:center; justify-content:center;">
        ${iconSvg}
      </div>
      ${badgeHtml}
    </div>
  `;

  return L.divIcon({
    className: "custom-map-pin",
    html,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -38],
  });
}

// 2. Create Cluster DivIcon for grouped markers
function createClusterIcon(count: number): L.DivIcon {
  const size = count > 100 ? 46 : count > 20 ? 40 : 36;
  const html = `
    <div style="width:${size}px; height:${size}px; border-radius:9999px; background:#007AFF; color:white; display:flex; align-items:center; justify-content:center; font-weight:800; font-family:monospace; font-size:12px; border:3px solid rgba(255,255,255,0.85); box-shadow:0 3px 8px rgba(0,122,255,0.4); cursor:pointer; transform:translate(-50%, -50%);">
      ${count}
    </div>
  `;
  return L.divIcon({
    className: "custom-cluster-pin",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// 3. Create Live User Location Marker with Rotating Heading Cone/Arrow
function createLiveLocationIcon(heading: number | null): L.DivIcon {
  const rotationStyle = heading != null ? `transform: rotate(${heading}deg);` : "";
  const coneHtml =
    heading != null
      ? `<div style="position:absolute; top:-18px; left:-6px; width:36px; height:36px; ${rotationStyle} pointer-events:none;">
          <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
            <path d="M18 0L26 24L18 20L10 24L18 0Z" fill="#007AFF" fill-opacity="0.35"/>
            <path d="M18 4L23 20L18 17L13 20L18 4Z" fill="#007AFF"/>
          </svg>
        </div>`
      : "";

  const html = `
    <div style="position:relative; width:24px; height:24px; display:flex; align-items:center; justify-content:center; transform:translate(-50%, -50%);">
      ${coneHtml}
      <div style="position:absolute; width:24px; height:24px; border-radius:9999px; background:#007AFF; opacity:0.25; animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width:14px; height:14px; border-radius:9999px; background:#007AFF; border:2.5px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.3); position:relative; z-index:2;"></div>
    </div>
  `;

  return L.divIcon({
    className: "live-location-pin",
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapInteractions({
  onMapClick,
  onZoomChange,
}: {
  onMapClick: (lat: number, lng: number) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function MapController({
  focusCoords,
  zoomLevel,
}: {
  focusCoords: [number, number] | null;
  zoomLevel?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (focusCoords) {
      map.setView(focusCoords, zoomLevel ?? 17, { animate: true });
    }
  }, [focusCoords, zoomLevel, map]);
  return null;
}

export interface MapViewProps {
  houses: HouseView[];
  teamMembers?: Array<{ id: string; name: string }>;
  focusedHouseId?: string | null;
  onSelectHouse?: (house: HouseView) => void;
}

export function MapView({
  houses,
  teamMembers = [],
  focusedHouseId = null,
  onSelectHouse,
}: MapViewProps) {
  const navigate = useNavigate();
  const refreshDataset = useRefreshDataset();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPinTypes, setSelectedPinTypes] = useState<string[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("all");
  const [showPins, setShowPins] = useState(true);
  const [allPinsFilterOpen, setAllPinsFilterOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Floating Plus (+) Selection Dialog State
  const [existingHousePickerOpen, setExistingHousePickerOpen] = useState(false);
  const [existingHouseSearch, setExistingHouseSearch] = useState("");
  const [newPinModalOpen, setNewPinModalOpen] = useState(false);

  // New Pin form fields
  const [pinDraftCoords, setPinDraftCoords] = useState<{ lat: number; lng: number; accuracy?: number | null } | null>(null);
  const [pinDraftType, setPinDraftType] = useState<string>("shop");
  const [pinDraftCustomLabel, setPinDraftCustomLabel] = useState<string>("");
  const [pinDraftAddress, setPinDraftAddress] = useState<string>("");
  const [selectedExistingHouseUuid, setSelectedExistingHouseUuid] = useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // House Builder Fields (used when Pin Type is House)
  const [draftBlock, setDraftBlock] = useState("B1");
  const [draftLane, setDraftLane] = useState("L1");
  const [draftSerialNo, setDraftSerialNo] = useState("001");
  const [draftHousingType, setDraftHousingType] = useState("Pakka");

  // GPS / Live Location State
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(14);

  const watchIdRef = useRef<number | null>(null);
  const toastFiredRef = useRef<boolean>(false);

  // Clear geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Active House for Canonical Bottom Sheet
  const [activeHouse, setActiveHouse] = useState<HouseView | null>(null);
  const [focusCoords, setFocusCoords] = useState<[number, number] | null>(null);

  // Device orientation / heading tracking
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading for iOS Safari, alpha for Android / standard
      if ((e as any).webkitCompassHeading != null) {
        setDeviceHeading((e as any).webkitCompassHeading);
      } else if (e.alpha != null && e.absolute) {
        setDeviceHeading(360 - e.alpha);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation, true);
      window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
    };
  }, []);

  // Filter logic
  const filteredHouses = useMemo(() => {
    return houses.filter((h) => {
      if (selectedTeamMember !== "all") {
        if (!h.house.mapped_by || h.house.mapped_by !== selectedTeamMember) return false;
      }
      if (selectedPinTypes.length > 0) {
        const pinType = (h.house.pin_type || "house").toLowerCase();
        if (!selectedPinTypes.includes(pinType)) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesHouse =
          h.house.house_id?.toLowerCase().includes(q) ||
          h.house.house_number?.toLowerCase().includes(q) ||
          h.house.owner_name?.toLowerCase().includes(q);
        const matchesMember = h.members.some((m) => m.name?.toLowerCase().includes(q));
        if (!matchesHouse && !matchesMember) return false;
      }
      return true;
    });
  }, [houses, selectedTeamMember, selectedPinTypes, searchQuery]);



  // Focused House Handler
  useEffect(() => {
    if (focusedHouseId) {
      const found = houses.find((h) => h.house.id === focusedHouseId || h.house.house_id === focusedHouseId);
      if (found && found.hasLocation) {
        setActiveHouse(found);
        setFocusCoords([found.house.latitude!, found.house.longitude!]);
      }
    }
  }, [focusedHouseId, houses]);

  // Calculate Pin Category Counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIN_CATALOG.forEach((p) => {
      counts[p.id] = 0;
    });

    houses.forEach((h) => {
      const type = (h.house.pin_type || "house").toLowerCase();
      counts[type] = (counts[type] ?? 0) + 1;
    });

    return counts;
  }, [houses]);

  // Marker Clustering removed, now handled by MarkerClusterGroup

  // Initial Center
  const initialCenter: [number, number] = useMemo(() => {
    if (activeHouse?.hasLocation) {
      return [activeHouse.house.latitude!, activeHouse.house.longitude!];
    }
    if (houses.length > 0) {
      const first = houses.find(h => h.hasLocation);
      if (first) return [first.house.latitude!, first.house.longitude!];
    }
    return mapConfig.defaultCenter;
  }, [activeHouse, houses]);

  // GPS / Live Location Handler
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    // Set up heading tracking (if supported, e.g. mobile devices)
    const handleOrientation = (event: DeviceOrientationEvent) => {
      let head = event.alpha;
      const evt = event as any;
      if (evt.webkitCompassHeading) {
        head = evt.webkitCompassHeading; // iOS
      }
      if (head != null) {
        setDeviceHeading(360 - head); // Convert to standard map rotation
      }
    };
    
    // Request permission for orientation if needed (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        })
        .catch(console.error);
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    toastFiredRef.current = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationPermissionDenied(false);
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 10,
        };
        // Also fallback to GPS heading if moving and orientation isn't supported
        if (pos.coords.heading != null && !deviceHeading) {
          setDeviceHeading(pos.coords.heading);
        }
        
        setCurrentLocation(coords);
        setFocusCoords([coords.lat, coords.lng]);
        
        if (!toastFiredRef.current) {
          toast.success(`Tracking location (±${Math.round(coords.accuracy)}m)`);
          toastFiredRef.current = true;
        }
      },
      (err) => {
        setLocationPermissionDenied(true);
        toast.error(`Location access denied: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [deviceHeading]);

  // Handle Tap anywhere on map
  const handleMapClick = (lat: number, lng: number) => {
    setPinDraftCoords({ lat, lng });
    setPinDraftType("house");
    setSelectedExistingHouseUuid(null);
    setNewPinModalOpen(true);
  };

  const handlePlusTap = () => {
    if (currentLocation) {
      setPinDraftCoords({ lat: currentLocation.lat, lng: currentLocation.lng, accuracy: currentLocation.accuracy });
    } else {
      setPinDraftCoords({ lat: initialCenter[0], lng: initialCenter[1] });
    }
    setPinDraftType("house");
    setSelectedExistingHouseUuid(null);
    setNewPinModalOpen(true);
  };

  // Save Standalone Pin / Link Existing House
  const handleSavePin = async () => {
    if (!pinDraftCoords) {
      toast.error("Missing coordinates for pin.");
      return;
    }

    setIsSavingPin(true);
    try {
      if (selectedExistingHouseUuid) {
        // Link to existing House ID
        await linkExistingHouseLocation({
          houseUuid: selectedExistingHouseUuid,
          pinType: pinDraftType,
          customType: pinDraftCustomLabel || null,
          latitude: pinDraftCoords.lat,
          longitude: pinDraftCoords.lng,
          accuracy: pinDraftCoords.accuracy ?? null,
          address: pinDraftAddress || null,
        });
        toast.success("Pin linked to existing household.");
      } else {
        // Create Standalone Pin
        await createStandalonePin({
          pinType: pinDraftType,
          customType: pinDraftCustomLabel || null,
          latitude: pinDraftCoords.lat,
          longitude: pinDraftCoords.lng,
          accuracy: pinDraftCoords.accuracy ?? null,
          address: pinDraftAddress || null,
        });
        toast.success("Map pin saved successfully.");
      }

      setNewPinModalOpen(false);
      setExistingHousePickerOpen(false);
      void refreshDataset();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save map pin.");
    } finally {
      setIsSavingPin(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-140px)] min-h-[580px] rounded-3xl overflow-hidden shadow-sm border border-border/80 bg-background">
      {/* 1. TOP FLOATING GLASSMORPHISM CONTROL PANEL */}
      <div className="absolute top-3 inset-x-3 z-20 pointer-events-auto space-y-2 max-w-lg mx-auto">
        <div className="card-surface ios-glass p-3.5 rounded-2xl border border-white/40 shadow-sm flex items-center justify-between backdrop-blur-xl bg-background/80">
          <div>
            <h2 className="font-display font-bold text-base text-foreground">Survey Map</h2>
            <p className="text-[11px] text-muted-foreground font-mono">
              {currentLocation
                ? `GPS accuracy ±${Math.round(currentLocation.accuracy)} m · ${filteredHouses.length} pins`
                : `Location ready · ${filteredHouses.length} pins`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold">
            <MapPin className="size-3.5" />
            <span>{filteredHouses.length}</span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search House ID, house number or member"
            className="h-11 pl-10 pr-4 rounded-2xl bg-background/80 backdrop-blur-xl border border-white/40 shadow-xs text-xs font-medium placeholder:text-muted-foreground"
          />
        </div>

        {/* Team Member Filter Selector */}
        <div className="relative">
          <select
            value={selectedTeamMember}
            onChange={(e) => setSelectedTeamMember(e.target.value)}
            className="w-full h-11 px-4 pr-9 rounded-2xl bg-background/80 backdrop-blur-xl border border-white/40 shadow-xs text-xs font-semibold text-foreground appearance-none cursor-pointer"
          >
            <option value="all">All team members</option>
            {teamMembers.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAllPinsFilterOpen(true)}
            className="flex-1 h-10 px-4 rounded-2xl bg-background/80 backdrop-blur-xl border border-white/40 shadow-xs text-xs font-semibold text-foreground flex items-center justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <span className="size-2.5 rounded-full shrink-0 bg-primary" />
              <span className="truncate">
                {selectedPinTypes.length === 0
                  ? "All Pins"
                  : selectedPinTypes.length === 1
                  ? getPinTypeConfig(selectedPinTypes[0]).label
                  : `${selectedPinTypes.length} types selected`}
              </span>
            </div>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => setShowPins(!showPins)}
            className="h-10 px-3.5 rounded-2xl bg-background/80 backdrop-blur-xl border border-white/40 shadow-xs text-xs font-semibold text-primary flex items-center gap-1.5 shrink-0"
          >
            {showPins ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </button>
        </div>

        {/* ALL DATA Summary Card */}
        <div className="card-surface ios-glass p-3 rounded-2xl border border-white/40 shadow-sm backdrop-blur-xl bg-background/80 text-center space-y-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-widest text-muted-foreground">ALL DATA</span>
          <div className="grid grid-cols-6 gap-1 divide-x divide-border/40">
            <div className="px-1">
              <p className="font-display font-bold text-xs text-foreground font-mono">{categoryCounts["house"] ?? 0}</p>
              <p className="text-[9px] text-muted-foreground">Houses</p>
            </div>
            <div className="px-1">
              <p className="font-display font-bold text-xs text-foreground font-mono">{categoryCounts["shop"] ?? 0}</p>
              <p className="text-[9px] text-muted-foreground">Shops</p>
            </div>
            <div className="px-1">
              <p className="font-display font-bold text-xs text-foreground font-mono">{categoryCounts["locked_house"] ?? 0}</p>
              <p className="text-[9px] text-muted-foreground">Locked</p>
            </div>
            <div className="px-1">
              <p className="font-display font-bold text-xs text-foreground font-mono">{categoryCounts["refused"] ?? 0}</p>
              <p className="text-[9px] text-muted-foreground">Refused</p>
            </div>
            <div className="px-1">
              <p className="font-display font-bold text-xs text-foreground font-mono">{(categoryCounts["empty_land"] ?? 0) + (categoryCounts["park"] ?? 0)}</p>
              <p className="text-[9px] text-muted-foreground">Land</p>
            </div>
            <div className="px-1">
              <p className="font-display font-bold text-xs text-primary font-mono">{houses.length}</p>
              <p className="text-[9px] font-bold text-primary">Total</p>
            </div>
          </div>
        </div>

        {/* Location Permission Denied Warning Card */}
        {locationPermissionDenied && (
          <div className="card-surface ios-glass p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
            <p className="text-xs text-foreground font-medium">
              Location permission denied. Enable it to see your position on the map.
            </p>
            <button
              type="button"
              onClick={handleLocateMe}
              className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-xs flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="size-3" /> Retry
            </button>
          </div>
        )}
      </div>

      {/* 2. LEAFLET MAP CONTAINER */}
      <MapContainer
        center={initialCenter}
        zoom={14}
        maxZoom={22}
        className="size-full z-0"
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          url={mapConfig.tileUrl}
          attribution={mapConfig.tileAttribution}
          maxZoom={22}
          maxNativeZoom={19}
        />
        <MapController focusCoords={focusCoords} zoomLevel={currentZoom} />
        <MapInteractions onMapClick={handleMapClick} onZoomChange={setCurrentZoom} />

        {currentLocation && (
          <>
            <Circle
              center={[currentLocation.lat, currentLocation.lng]}
              radius={currentLocation.accuracy}
              pathOptions={{
                color: "#007AFF",
                fillColor: "#007AFF",
                fillOpacity: 0.15,
                weight: 1.5,
              }}
            />
            <Marker
              position={[currentLocation.lat, currentLocation.lng]}
              icon={createLiveLocationIcon(deviceHeading)}
            />
          </>
        )}

        {/* Render Map Markers / Clusters */}
        {showPins && (
          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={(cluster: any) => createClusterIcon(cluster.getChildCount())}
            maxClusterRadius={40}
            showCoverageOnHover={false}
            disableClusteringAtZoom={20}
          >
            {filteredHouses.map((h) => {
              if (!h.hasLocation || h.house.latitude == null || h.house.longitude == null) return null;
              const lat = h.house.latitude;
              const lng = h.house.longitude;
              const pinType = h.house.pin_type || "house";
              const badge = h.members.length > 0 ? h.members.length : undefined;
              const icon = createCustomPinIcon(pinType, h.risk, badge);

              return (
                <Marker
                  key={h.house.id}
                  position={[lat, lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      setActiveHouse(h);
                      if (onSelectHouse) onSelectHouse(h);
                    },
                  }}
                />
              );
            })}
          </MarkerClusterGroup>
        )}
      </MapContainer>

      {/* 3. FLOATING ACTION BUTTONS (Bottom Right) */}
      <div className="absolute bottom-5 right-4 z-20 flex flex-col gap-2.5 pointer-events-auto">


        {/* Crosshair / Locate Me Button */}
        <button
          type="button"
          onClick={handleLocateMe}
          className="size-11 rounded-full bg-background/85 backdrop-blur-xl border border-white/40 shadow-md text-foreground flex items-center justify-center transition-transform active:scale-90 hover:bg-background"
        >
          <LocateFixed className="size-4.5 text-primary" />
        </button>

        {/* Floating Plus (+) Button */}
        <button
          type="button"
          onClick={handlePlusTap}
          className="size-13 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform active:scale-95 hover:bg-primary/90"
        >
          <Plus className="size-6 stroke-[2.5]" />
        </button>
      </div>

      {/* 4. ALL PINS FILTER DRAWER (Shows all 20 categories with dynamic counts) */}
      <Drawer open={allPinsFilterOpen} onOpenChange={setAllPinsFilterOpen}>
        <DrawerContent className="max-w-md mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-2xl">
          <div className="px-5 pb-8 pt-2 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />
            <DrawerHeader className="text-left px-0 pb-1">
              <DrawerTitle className="font-display text-lg font-bold">Filter Map by Category</DrawerTitle>
              <DrawerDescription className="text-xs">
                Select a category to isolate pins on the survey map.
              </DrawerDescription>
            </DrawerHeader>

            {/* "All Pins" option */}
            <button
              type="button"
              onClick={() => {
                setSelectedPinTypes([]);
                setAllPinsFilterOpen(false);
              }}
              className={cn(
                "w-full p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold transition-all",
                selectedPinTypes.length === 0
                  ? "bg-primary/10 border-primary text-primary shadow-xs"
                  : "bg-surface text-foreground border-border/70 hover:bg-surface-muted"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="size-3 rounded-full bg-primary" />
                <span>All Pins (Show Everything)</span>
              </div>
              <span className="font-mono font-bold text-muted-foreground">{houses.length}</span>
            </button>

            {/* Grid of 20 Categories */}
            <div className="grid grid-cols-2 gap-2">
              {PIN_CATALOG.map((cat) => {
                const isSelected = selectedPinTypes.includes(cat.id);
                const count = categoryCounts[cat.id] ?? 0;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPinTypes(selectedPinTypes.filter(t => t !== cat.id));
                      } else {
                        setSelectedPinTypes([...selectedPinTypes, cat.id]);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-2xl border flex items-center justify-between text-xs transition-all",
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                        : "bg-surface text-foreground border-border/70 hover:bg-surface-muted font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className="size-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate">{cat.label}</span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground ml-1">{count}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center gap-3 pt-4 border-t border-border/40 mt-4">
               <button
                  type="button"
                  onClick={() => {
                    setSelectedPinTypes([]);
                  }}
                  className="px-4 py-3 rounded-2xl border border-border/60 font-semibold text-xs text-foreground bg-surface hover:bg-surface-muted transition-colors flex-1"
               >
                 Clear All
               </button>
               <button
                  type="button"
                  onClick={() => setAllPinsFilterOpen(false)}
                  className="px-4 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs shadow-md transition-colors flex-1"
               >
                 Apply Filters
               </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* 6. EXISTING HOUSE PICKER DRAWER */}
      <Drawer open={existingHousePickerOpen} onOpenChange={setExistingHousePickerOpen}>
        <DrawerContent className="max-w-md mx-auto rounded-t-3xl border-border bg-background/95 backdrop-blur-2xl">
          <div className="px-5 pb-8 pt-2 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full mb-1" />
            <DrawerHeader className="text-left px-0 pb-1">
              <DrawerTitle className="font-display text-lg font-bold">Select Existing House ID</DrawerTitle>
              <DrawerDescription className="text-xs">
                Link this pin location to an existing unmapped or existing house record.
              </DrawerDescription>
            </DrawerHeader>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search House ID, number, or owner..."
                value={existingHouseSearch}
                onChange={(e) => setExistingHouseSearch(e.target.value)}
                className="h-10 pl-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {houses
                .filter((h) => {
                  if (!existingHouseSearch.trim()) return true;
                  const q = existingHouseSearch.toLowerCase().trim();
                  return (
                    (h.house.house_id || "").toLowerCase().includes(q) ||
                    (h.house.house_number || "").toLowerCase().includes(q) ||
                    (h.house.owner_name || "").toLowerCase().includes(q)
                  );
                })
                .slice(0, 30)
                .map((h) => (
                  <button
                    key={h.house.id}
                    type="button"
                    onClick={() => {
                      setSelectedExistingHouseUuid(h.house.id);
                      setPinDraftType(h.house.pin_type || "house");
                      setPinDraftAddress(h.house.address || "");
                      setExistingHousePickerOpen(false);
                      setNewPinModalOpen(true);
                    }}
                    className="w-full p-3 rounded-xl border border-border/70 bg-surface hover:bg-surface-muted text-left flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <p className="font-bold text-foreground">
                        {h.house.house_id ?? h.house.house_number ?? "Unnumbered House"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {h.house.address || "No address recorded"} • {h.members.length} members
                      </p>
                    </div>
                    <span className="text-[10px] text-primary font-bold">Select →</span>
                  </button>
                ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* 7. REUSABLE NEW / EDIT PIN MODAL */}
      <PinSheet
        open={newPinModalOpen}
        onOpenChange={setNewPinModalOpen}
        coords={pinDraftCoords}
        existingHouseIds={houses.map((h) => h.house.house_id).filter(Boolean) as string[]}
        selectedExistingHouseUuid={selectedExistingHouseUuid}
        onRequestExistingPicker={() => setExistingHousePickerOpen(true)}
        prefillType={pinDraftType}
        prefillAddress={pinDraftAddress}
      />

      {/* 8. REUSABLE BOTTOM SHEETS FOR PINS */}
      {activeHouse && ["house", "locked_house", "refused"].includes(activeHouse.house.pin_type?.toLowerCase() || "house") ? (
        <HouseDetailSheet
          house={activeHouse}
          open={Boolean(activeHouse)}
          onOpenChange={(open) => !open && setActiveHouse(null)}
        />
      ) : (
        <POIDetailSheet
          poi={activeHouse}
          open={Boolean(activeHouse)}
          onOpenChange={(open) => !open && setActiveHouse(null)}
        />
      )}
    </div>
  );
}
