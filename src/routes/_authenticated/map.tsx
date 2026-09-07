import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Crosshair,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  Play,
  Layers,
  Radio,
  Trash2,
  ShieldAlert,
  Palette,
} from "lucide-react";
import { z } from "zod";

import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getOptimizedRoute, getLocalTspRoute } from "@/services/routingService";
import { useDataset, useRefreshDataset } from "@/hooks/useDataset";
import { useTeamMemberships, useUsers } from "@/hooks/useUsers";
import { getUserDisplayName } from "@/services/userService";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/db/client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SharedMap } from "@/components/map/SharedMap";
import { PIN_TYPES, pinTypeDef, pinTypeLabel, distanceMeters, type Pin } from "@/lib/pin-types";
import type { RiskLevel, ClinicalRiskState } from "@/config/risk";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";
import { GlobalFilterSheet } from "@/components/common/GlobalFilterSheet";
import { PinFormSheet, type PinDraft } from "@/components/map/PinFormSheet";
// Using existing components from Management App where appropriate.

const mapSearchSchema = z.object({
  houseId: z.string().optional(),
  filter: z.enum(["today_followups"]).optional(),
  locate: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/map")({
  ssr: false,
  validateSearch: mapSearchSchema,
  head: () => ({
    meta: [
      { title: "Map — Management App by Ibrahim Labs" },
      {
        name: "description",
        content: "Interactive GPS survey map with pins, filters, and house details.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { user, isAdmin } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useDataset();
  const { data: users } = useUsers();
  const { data: teamMemberships } = useTeamMemberships();

  const { position, heading, error: geoError, retry } = useGeolocation();

  let houses = data?.houses ?? [];
  const followUps = data?.followUps ?? [];
  const members = data?.members ?? [];

  const [types, setTypes] = useState<string[]>([]);
  const [showPins, setShowPins] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [houseTerm, setHouseTerm] = useState("");
  const [houseOpen, setHouseOpen] = useState(false);
  const houseMatches = useMemo(() => {
    if (!houseTerm.trim()) return [];
    const q = houseTerm.trim().toLowerCase();
    return houses.filter((h) => {
      const matchHouse =
        h.house.house_id?.toLowerCase().includes(q) ||
        h.house.house_number?.toLowerCase().includes(q) ||
        h.house.owner_name?.toLowerCase().includes(q);
      const matchMember = h.members.some((m) => m.name?.toLowerCase().includes(q));
      return matchHouse || matchMember;
    });
  }, [houses, houseTerm]);

  const [activeHouse, setActiveHouse] = useState<any | null>(null);
  const [placing, setPlacing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Territory Area and Drawing State
  const [areas, setAreas] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem("NCD_TERRITORY_AREAS");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [territoriesPanelOpen, setTerritoriesPanelOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState<"polygon" | "polyline" | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ lat: number; lng: number }[]>([]);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaColor, setNewAreaColor] = useState("#2563eb");
  const [newAreaCHW, setNewAreaCHW] = useState<string>("");
  const [saveAreaDialogOpen, setSaveAreaDialogOpen] = useState(false);

  // GPS Sharing & Geofencing
  const [gpsSharingEnabled, setGpsSharingEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("NCD_GPS_SHARING") === "true";
    } catch {
      return false;
    }
  });
  const [gpsPromptOpen, setGpsPromptOpen] = useState(false);
  const [lastGeofenceAlert, setLastGeofenceAlert] = useState<number>(0);

  // Load territory areas from Supabase if available
  useEffect(() => {
    async function loadAreas() {
      try {
        const { data: dbAreas, error } = await supabase.from("map_areas").select("*");
        if (!error && dbAreas && dbAreas.length > 0) {
          setAreas(dbAreas);
          localStorage.setItem("NCD_TERRITORY_AREAS", JSON.stringify(dbAreas));
        }
      } catch {
        // Fallback to local storage
      }
    }
    loadAreas();
  }, []);

  const handleAddDrawingPoint = useCallback((pt: { lat: number; lng: number }) => {
    setDrawingPoints((prev) => [...prev, pt]);
  }, []);

  const cancelDrawing = () => {
    setDrawingMode(null);
    setDrawingPoints([]);
  };

  const handleSaveArea = async () => {
    if (!newAreaName.trim()) {
      toast.error("Enter a name for this territory sector.");
      return;
    }
    if (drawingPoints.length < (drawingMode === "polygon" ? 3 : 2)) {
      toast.error(`At least ${drawingMode === "polygon" ? 3 : 2} points required.`);
      return;
    }

    let geometry: any;
    if (drawingMode === "polygon") {
      const closed = [
        ...drawingPoints.map((p) => [p.lng, p.lat]),
        [drawingPoints[0]!.lng, drawingPoints[0]!.lat],
      ];
      geometry = {
        type: "Polygon",
        coordinates: [closed],
      };
    } else {
      geometry = {
        type: "LineString",
        coordinates: drawingPoints.map((p) => [p.lng, p.lat]),
      };
    }

    const newArea = {
      id: crypto.randomUUID(),
      name: newAreaName.trim(),
      color: newAreaColor,
      geometry,
      assigned_chw_id: newAreaCHW || null,
      created_at: new Date().toISOString(),
    };

    const updated = [...areas, newArea];
    setAreas(updated);
    localStorage.setItem("NCD_TERRITORY_AREAS", JSON.stringify(updated));

    try {
      await supabase.from("map_areas").insert({
        id: newArea.id,
        name: newArea.name,
        color: newArea.color,
        geometry: newArea.geometry,
        assigned_chw_id: newArea.assigned_chw_id,
        organization_id:
          (user?.profile as any)?.organization_id || "00000000-0000-0000-0000-000000000000",
      });
    } catch {
      // Offline fallback preserved
    }

    toast.success(`Territory sector "${newArea.name}" created!`);
    setSaveAreaDialogOpen(false);
    setDrawingMode(null);
    setDrawingPoints([]);
    setNewAreaName("");
    setNewAreaCHW("");
  };

  const handleDeleteArea = async (id: string) => {
    const updated = areas.filter((a) => a.id !== id);
    setAreas(updated);
    localStorage.setItem("NCD_TERRITORY_AREAS", JSON.stringify(updated));
    try {
      const { error } = await supabase.from("map_areas").delete().eq("id", id);
      if (error) console.error("Failed to delete map area:", error);
    } catch {
      // Offline fallback
    }
    toast.info("Territory removed");
  };

  // Geofencing verification
  useEffect(() => {
    if (!position || areas.length === 0) return;
    const now = Date.now();
    if (now - lastGeofenceAlert < 5 * 60 * 1000) return; // Debounce 5 min

    // If user is a CHW, check if assigned to any territory
    const myAssignedAreas = areas.filter(
      (a) => a.assigned_chw_id === user?.userId && a.geometry?.type === "Polygon",
    );
    if (myAssignedAreas.length > 0) {
      let isInsideAny = false;
      const pt = { lat: position.lat, lng: position.lng };
      for (const a of myAssignedAreas) {
        const ring = a.geometry?.coordinates?.[0] ?? [];
        if (ring.length >= 3) {
          // Point in polygon
          let inside = false;
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0],
              yi = ring[i][1];
            const xj = ring[j][0],
              yj = ring[j][1];
            const intersect =
              yi > pt.lat !== yj > pt.lat && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
          }
          if (inside) {
            isInsideAny = true;
            break;
          }
        }
      }

      if (!isInsideAny) {
        setLastGeofenceAlert(now);
        toast.warning(
          "Geofence Alert: Current GPS location is outside your assigned survey territory.",
          { duration: 6000 },
        );
      }
    }
  }, [position, areas, user?.userId, lastGeofenceAlert]);

  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [newPinType, setNewPinType] = useState<string>("house");
  const [focus, setFocus] = useState<{ lat: number; lng: number; id?: string } | null>(null);
  const [stack, setStack] = useState<Pin[] | null>(null);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

  const [locatingHouse, setLocatingHouse] = useState<any | null>(null);
  const [move, setMove] = useState<{ pin: Pin; lat: number; lng: number } | null>(null);

  const queryClient = useQueryClient();
  const [savingHouse, setSavingHouse] = useState(false);
  const [movingPin, setMovingPin] = useState(false);

  // Follow-up Filter
  if (search.filter === "today_followups") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const housesWithFollowups = new Set<string>();

    for (const f of followUps) {
      if (f.status !== "completed" && f.status !== "missed") {
        let dueDate: Date | null = null;
        if (f.due_date) {
          const d = new Date(f.due_date);
          if (!isNaN(d.getTime())) {
            d.setHours(0, 0, 0, 0);
            dueDate = d;
          }
        }
        if (dueDate && dueDate.getTime() <= todayTime) {
          const m = members.find((x) => x.id === f.member_uuid);
          if (m && m.houseUuid) {
            housesWithFollowups.add(m.houseUuid);
          }
        }
      }
    }
    houses = houses.filter((h) => housesWithFollowups.has(h.house.id));
  }

  const unmappedRunHouses = useMemo(() => {
    if (search.filter !== "today_followups") return [];
    return houses.filter(
      (h) => !h.hasLocation || h.house.latitude == null || h.house.longitude == null,
    );
  }, [houses, search.filter]);

  const teamMembers = useMemo(() => {
    if (!teamMemberships || !users || !user) return [];
    const myTeam = teamMemberships.filter(
      (tm) => tm.supervisor_id === user.userId && tm.status === "active",
    );
    return myTeam.map((tm) => {
      const u = users.find((u) => u.profile.id === tm.csw_id);
      return { id: tm.csw_id, name: getUserDisplayName(u) };
    });
  }, [teamMemberships, users, user]);

  const pins: Pin[] = useMemo(() => {
    const list: Pin[] = [];
    for (const h of houses) {
      if (!h.hasLocation || h.house.latitude == null || h.house.longitude == null) continue;

      // The GlobalFilterSheet (via useDataset) handles general role filtering,
      // but we maintain the base security scope here just in case.

      // Security role check based on architecture requirement
      if (!isAdmin && user) {
        if (user.role === "survey_user") {
          // CHW can only see their own pins
          if (h.house.mapped_by !== user.userId) continue;
        } else if (user.role === "supervisor") {
          // Supervisor can see own pins and pins from their team
          if (h.house.mapped_by !== user.userId) {
            const inTeam = teamMemberships?.some(
              (tm) =>
                tm.supervisor_id === user.userId &&
                tm.csw_id === h.house.mapped_by &&
                tm.status === "active",
            );
            if (!inTeam) continue;
          }
        }
      }

      // Filter by pin type
      const pType = (h.house.pin_type || "house").toLowerCase();
      if (types.length > 0 && !types.includes(pType)) continue;

      // Search term
      if (houseTerm) {
        const q = houseTerm.toLowerCase();
        const matchesHouse =
          h.house.house_id?.toLowerCase().includes(q) ||
          h.house.house_number?.toLowerCase().includes(q) ||
          h.house.owner_name?.toLowerCase().includes(q);
        const matchesMember = h.members.some((m) => m.name?.toLowerCase().includes(q));
        if (!matchesHouse && !matchesMember) continue;
      }

      list.push({
        id: h.house.id,
        user_id: h.house.mapped_by || "",
        username: h.house.mapped_by || "",
        latitude: h.house.latitude,
        longitude: h.house.longitude,
        accuracy: null,
        pin_type: pType,
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
  }, [houses, types, houseTerm, isAdmin, user, teamMemberships]);

  // Real road routing logic for RUN mode
  const [route, setRoute] = useState<{ lat: number; lng: number }[] | undefined>(undefined);

  useEffect(() => {
    if (search.filter !== "today_followups" || pins.length === 0 || !position) {
      setRoute(undefined);
      return;
    }

    const runRouting = async () => {
      const locations = [
        { lat: position.lat, lng: position.lng },
        ...pins.map((p) => ({ lat: p.latitude, lng: p.longitude })),
      ];

      // Try OSRM real road routing
      const optimized = await getOptimizedRoute(locations);
      if (optimized && optimized.geometry && Array.isArray(optimized.geometry)) {
        // Convert [lat, lng] arrays back to objects for LeafletMap
        const geoRoute = optimized.geometry.map((pt: [number, number]) => ({
          lat: pt[0],
          lng: pt[1],
        }));
        setRoute(geoRoute);
      } else {
        // Fallback to straight line TSP
        setRoute(getLocalTspRoute(locations));
      }
    };

    runRouting();
  }, [search.filter, pins, position]);

  const nearestPinId = useMemo(() => {
    if (search.filter !== "today_followups" || pins.length === 0 || !position) return null;
    let closestId: string | null = null;
    let minDist = Infinity;
    for (const p of pins) {
      // Haversine distance or simple euclidean is enough for local approximation
      const dx = p.latitude - position.lat;
      const dy = (p.longitude - position.lng) * Math.cos(position.lat * (Math.PI / 180));
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closestId = p.id;
      }
    }
    return closestId;
  }, [search.filter, pins, position]);

  const riskByHouse = useMemo(() => {
    const out: Record<string, ClinicalRiskState> = {};
    for (const h of houses) {
      if (h.house.house_id) {
        out[h.house.house_id.trim().toUpperCase()] = h.risk;
      }
    }
    return out;
  }, [houses]);

  const canMove = useCallback(
    (pin: Pin) => isAdmin || pin.user_id === user?.id,
    [isAdmin, user?.id],
  );

  const handleSelect = useCallback(
    (pin: Pin) => {
      const found = houses.find((h) => h.house.id === pin.id);
      if (found) {
        setActiveHouse(found);
      }
    },
    [houses],
  );

  const handleSelectMany = useCallback((group: Pin[]) => setStack(group), []);
  const handleDragged = useCallback((pin: Pin, latlng: { lat: number; lng: number }) => {
    setMove({ pin, lat: latlng.lat, lng: latlng.lng });
  }, []);

  const handleTap = useCallback(
    (latlng: { lat: number; lng: number }) => {
      if (editMode) return;
      if (locatingHouse) {
        setDraft(latlng);
        return;
      }
      if (search.filter === "today_followups") {
        return; // disable adding pins in RUN mode to avoid confusion
      }
      setDraft(latlng);
      setPlacing(true);
      setFormOpen(true);
    },
    [editMode, locatingHouse, search.filter],
  );

  const startHouseLocation = useCallback(
    (houseId: string) => {
      const house = houses.find((h) => h.house.id === houseId);
      if (!house) return;
      setActiveHouse(null);
      setEditMode(false);
      setPlacing(false);
      setLocatingHouse(house);
      const start =
        house.hasLocation && house.house.latitude !== null && house.house.longitude !== null
          ? { lat: house.house.latitude, lng: house.house.longitude }
          : position
            ? { lat: position.lat, lng: position.lng }
            : null;
      setDraft(start);
      if (start) setFocus({ lat: start.lat, lng: start.lng });
      else toast.info("Tap the map to place this house");
    },
    [houses, position],
  );

  // Handle locate search param to start house mapping flow
  useEffect(() => {
    if (search.locate && search.houseId && houses.length > 0) {
      if (!locatingHouse || locatingHouse.house.id !== search.houseId) {
        startHouseLocation(search.houseId);
      }
    }
  }, [search.locate, search.houseId, houses, locatingHouse, startHouseLocation]);

  async function confirmHouseLocation() {
    if (!locatingHouse || !draft) return;
    setSavingHouse(true);
    try {
      const { error } = await supabase
        .from("houses")
        .update({
          latitude: draft.lat,
          longitude: draft.lng,
        })
        .eq("id", locatingHouse.house.id);

      if (error) throw error;

      toast.success("Location mapped");
      setLocatingHouse(null);
      setDraft(null);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingHouse(false);
    }
  }

  async function confirmNewPin(pinDraft: PinDraft) {
    if (!draft) return;
    setSavingHouse(true);
    
    let assignedAreaId: string | undefined = undefined;
    
    // Find which territory this pin falls into
    if (areas.length > 0) {
      const pt = { lat: pinDraft.latitude, lng: pinDraft.longitude };
      for (const a of areas) {
        if (a.geometry?.type === "Polygon") {
          const ring = a.geometry?.coordinates?.[0] ?? [];
          if (ring.length >= 3) {
            let inside = false;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              const xi = ring[i][0], yi = ring[i][1];
              const xj = ring[j][0], yj = ring[j][1];
              const intersect = ((yi > pt.lat) !== (yj > pt.lat))
                  && (pt.lng < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi);
              if (intersect) inside = !inside;
            }
            if (inside) {
              assignedAreaId = a.id;
              break; // Found the area
            }
          }
        }
      }
    }

    try {
      const { error } = await supabase.from("houses").insert({
        house_id: pinDraft.house_id || `PIN-${Math.floor(Math.random() * 10000)}`,
        latitude: pinDraft.latitude,
        longitude: pinDraft.longitude,
        accuracy: pinDraft.accuracy,
        pin_type: pinDraft.pin_type,
        custom_type: pinDraft.custom_type,
        house_number: pinDraft.house_number,
        owner_name: pinDraft.owner_name,
        address: pinDraft.notes || "Added from Map",
        mapped_by: user?.userId,
        area_id: assignedAreaId,
        created_by: user?.userId,
      });

      if (error) throw error;

      toast.success("Pin created");
      setPlacing(false);
      setFormOpen(false);
      setDraft(null);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingHouse(false);
    }
  }

  async function confirmMove() {
    if (!move) return;
    setMovingPin(true);
    try {
      // In Management app, the "pin" refers to a house location.
      // We will only update houses for now.
      const { error } = await supabase
        .from("houses")
        .update({
          latitude: move.lat,
          longitude: move.lng,
        })
        .eq("id", move.pin.id);

      if (error) throw error;

      toast.success("Location updated");
      setMove(null);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMovingPin(false);
    }
  }

  const countOf = useCallback(
    (list: Pin[], type: string) => list.filter((p) => p.pin_type === type).length,
    [],
  );

  const toggleFilter = (type: string) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  if (isLoading)
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );

  if (error) {
    return <div>Error loading data</div>;
  }

  return (
    <div className="relative h-[calc(100dvh-57px)] lg:h-screen w-full overflow-hidden bg-muted">
      <div className="absolute bottom-0 left-0 right-0 top-0 z-0">
        <SharedMap
          pins={pins}
          showPins={showPins}
          position={position}
          heading={heading}
          draft={draft}
          focus={focus}
          addMode={Boolean(locatingHouse) || Boolean(drawingMode)}
          editMode={editMode}
          riskByHouse={riskByHouse}
          route={route}
          nearestPinId={nearestPinId}
          areas={areas}
          drawingMode={drawingMode}
          drawingPoints={drawingPoints}
          onAddDrawingPoint={handleAddDrawingPoint}
          canMove={canMove}
          onMapTap={handleTap}
          onDraftMove={setDraft}
          onSelectPin={handleSelect}
          onSelectMany={handleSelectMany}
          onPinDragged={handleDragged}
        />
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex max-h-full flex-col overflow-y-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-40 md:right-auto md:w-[22rem] md:pb-8">
        <div className="card-surface ios-glass pointer-events-auto flex items-center justify-between rounded-3xl px-4 py-3 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm mt-2 lg:mt-6">
          <div>
            <p className="text-[15px] font-semibold leading-tight text-foreground">Survey Map</p>
            <p className="text-[12px] text-muted-foreground font-mono">
              {position
                ? `GPS ±${Math.round(position.accuracy)}m · ${pins.length} pins`
                : geoError
                  ? "Location unavailable"
                  : "Locating…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GlobalFilterSheet />
            <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary">
              <MapPin className="size-3.5" />
              {pins.length}
            </span>
          </div>
        </div>

        <div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-3 py-2.5 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={houseTerm}
              onChange={(e) => {
                setHouseTerm(e.target.value);
                setHouseOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pins.length > 0) {
                  const first = pins[0];
                  if (first) {
                    setFocus({ lat: first.latitude, lng: first.longitude });
                    handleSelect(first);
                  }
                  // Optional: clear search term if we want to show all pins again
                  // setHouseTerm("");
                }
              }}
              placeholder="Search House ID, number or member"
              className="w-full bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {houseOpen && houseMatches.length > 0 ? (
            <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {houseMatches.slice(0, 20).map((h) => (
                <button
                  key={h.house.id}
                  type="button"
                  onClick={() => {
                    setHouseOpen(false);
                    setHouseTerm("");
                    setActiveHouse(h);
                    if (h.hasLocation && h.house.latitude !== null && h.house.longitude !== null) {
                      setFocus({ lat: h.house.latitude, lng: h.house.longitude });
                    }
                  }}
                  className="press flex w-full items-center justify-between gap-2 rounded-xl bg-card/70 px-3 py-2 text-left border border-white/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-foreground">
                      {h.house.house_id}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      House No. {h.house.house_number || "—"} · {h.members?.length ?? 0} members
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      !h.hasLocation || h.house.latitude === null
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {!h.hasLocation || h.house.latitude === null ? "Not mapped" : "Mapped"}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {houseOpen && houseTerm.trim() && !houseMatches.length ? (
            <p className="mt-2 text-[11px] text-muted-foreground">No matching house found.</p>
          ) : null}
        </div>

        {/* Filters */}
        <div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-3 py-2.5 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex-1 h-9 px-3 rounded-xl bg-card/70 border border-white/20 text-[12px] font-semibold text-left truncate flex items-center justify-between"
            >
              <span>{types.length === 0 ? "All Pins" : `${types.length} types selected`}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPins(!showPins)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 h-9 text-[12px] font-semibold border border-white/20",
                showPins ? "bg-primary/10 text-primary" : "bg-card/70 text-muted-foreground",
              )}
            >
              {showPins ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </button>
          </div>
          {filtersOpen && (
            <div className="mt-2.5 max-h-56 overflow-y-auto pr-1">
              <button
                onClick={() => setTypes([])}
                className={cn(
                  "w-full text-left px-3 py-2 text-[12px] rounded-xl mb-1.5 font-semibold",
                  types.length === 0 ? "bg-primary/15 text-primary" : "bg-card/70",
                )}
              >
                All Pins · {pins.length}
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                {PIN_TYPES.map((t) => {
                  const on = types.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      onClick={() => toggleFilter(t.value)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-medium text-left",
                        on ? "bg-primary/15 text-primary" : "bg-card/70",
                      )}
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ background: t.color }}
                      />
                      <span className="truncate flex-1">{t.label}</span>
                      <span className="opacity-70 tabular-nums">{countOf(pins, t.value)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {editMode ? (
          <div className="card-surface ios-glass pointer-events-auto mt-2 flex items-center justify-between rounded-2xl px-4 py-2.5 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
            <p className="text-[13px] font-medium text-foreground">
              Edit mode — drag a pin to move it
            </p>
            <button
              type="button"
              onClick={() => {
                setEditMode(false);
                setMove(null);
              }}
              className="press grid size-7 place-items-center rounded-full bg-card/70 border border-border"
              aria-label="Exit edit mode"
            >
              <X className="size-4 text-foreground" />
            </button>
          </div>
        ) : null}

        {locatingHouse ? (
          <div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-4 py-3 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
            <p className="text-[13px] font-semibold text-foreground">
              {!locatingHouse.hasLocation ? "Add location" : "Edit location"} ·{" "}
              {locatingHouse.house.house_id}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Old:{" "}
              {!locatingHouse.hasLocation
                ? "Not mapped"
                : `${locatingHouse.house.latitude?.toFixed(6)}, ${locatingHouse.house.longitude?.toFixed(6)}`}
            </p>
            <p className="text-[11px] text-muted-foreground">
              New:{" "}
              {draft
                ? `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}`
                : "Tap the map or drag the marker"}
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLocatingHouse(null);
                  setDraft(null);
                }}
                className="press rounded-xl bg-card/70 border border-border py-2.5 text-[12px] font-semibold text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft || savingHouse}
                onClick={confirmHouseLocation}
                className="press flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60 shadow-md"
              >
                <Check className="size-3.5" />
                Save Location
              </button>
            </div>
          </div>
        ) : null}

        {move ? (
          <div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-4 py-3 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
            <p className="text-[13px] font-semibold text-foreground">
              Move {pinTypeLabel(move.pin.pin_type, move.pin.custom_type)}
              {move.pin.house_id ? ` · ${move.pin.house_id}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Original: {move.pin.latitude.toFixed(6)}, {move.pin.longitude.toFixed(6)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              New: {move.lat.toFixed(6)}, {move.lng.toFixed(6)}
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMove(null)}
                className="press rounded-xl bg-card/70 border border-border py-2.5 text-[12px] font-semibold text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={movingPin}
                onClick={confirmMove}
                className="press flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-70 shadow-md"
              >
                <Check className="size-3.5" />
                Save Location
              </button>
            </div>
          </div>
        ) : null}

        {placing && !formOpen ? (
          <div className="card-surface ios-glass pointer-events-auto mt-2 flex items-center justify-between rounded-2xl px-4 py-2.5 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
            <p className="text-[13px] font-medium text-foreground">Tap the map to place your pin</p>
            <button
              type="button"
              onClick={() => {
                setPlacing(false);
                setDraft(null);
              }}
              className="press grid size-7 place-items-center rounded-full bg-card/70 border border-border"
              aria-label="Exit add pin mode"
            >
              <X className="size-4 text-foreground" />
            </button>
          </div>
        ) : null}
      </div>

      {search.filter === "today_followups" && pins.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center pb-20">
          <div className="pointer-events-auto rounded-3xl bg-background/90 backdrop-blur-xl px-6 py-4 shadow-2xl border border-white/20 text-center flex flex-col items-center">
            <Check className="size-10 text-primary mb-3 bg-primary/10 p-2 rounded-full" />
            <h3 className="font-bold text-lg text-foreground">No follow-ups due today</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
              You've cleared your schedule. Exit RUN mode to see all pins.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/map", search: {} })}
              className="mt-4 press w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md"
            >
              Exit RUN Mode
            </button>
          </div>
        </div>
      )}

      {search.filter === "today_followups" && unmappedRunHouses.length > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              // Open the first unmapped house's detail sheet to map it
              const firstUnmapped = unmappedRunHouses[0];
              if (firstUnmapped) {
                setActiveHouse(firstUnmapped);
              }
            }}
            className="press flex items-center gap-2 bg-amber-500/90 hover:bg-amber-500 backdrop-blur-md text-white px-4 py-2 rounded-xl shadow-lg border border-amber-400 font-medium text-xs md:text-sm"
          >
            <MapPin className="size-4" />
            {unmappedRunHouses.length} unmapped follow-up{unmappedRunHouses.length > 1 ? "s" : ""}
          </button>
        </div>
      )}

      {search.filter === "today_followups" ? (
        <div className="absolute top-4 right-4 z-30 md:top-6 md:right-6 pointer-events-auto">
          <button
            type="button"
            onClick={() => navigate({ to: "/map", search: {} })}
            className="press flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-rose-500/20 font-bold border border-rose-400"
          >
            <X className="size-5" />
            Exit RUN
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate({ to: "/map", search: { filter: "today_followups" } })}
          className="press absolute bottom-[27.5rem] right-4 z-30 md:bottom-72 grid h-12 px-5 place-items-center rounded-2xl shadow-lg border bg-background/80 backdrop-blur-xl border-white/40 text-primary font-bold text-sm flex items-center gap-2"
        >
          <Play className="size-4 fill-primary" />
          RUN
        </button>
      )}

      {/* Territory Areas Management Toggle */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => setTerritoriesPanelOpen(true)}
          className="press glass absolute bottom-[23rem] right-4 z-30 md:bottom-56 grid size-12 place-items-center rounded-2xl text-primary bg-background/85 border border-white/20 shadow-md"
          aria-label="Territory areas"
          title="Territory Areas & Geofences"
        >
          <Layers className="size-5" />
        </button>
      )}

      {/* GPS Sharing Toggle */}
      <button
        type="button"
        onClick={() => {
          if (!gpsSharingEnabled) {
            setGpsPromptOpen(true);
          } else {
            setGpsSharingEnabled(false);
            localStorage.setItem("NCD_GPS_SHARING", "false");
            toast.info("Live GPS sharing paused.");
          }
        }}
        className={cn(
          "press glass absolute bottom-[19rem] right-4 z-30 md:bottom-40 grid size-12 place-items-center rounded-2xl border border-white/20 shadow-md transition-all",
          gpsSharingEnabled
            ? "bg-emerald-600 text-white shadow-emerald-500/20 animate-pulse"
            : "text-muted-foreground bg-background/85",
        )}
        aria-label="Live GPS Sharing"
        title={gpsSharingEnabled ? "Live GPS Sharing Active" : "Enable Live GPS Sharing"}
      >
        <Radio className="size-5" />
      </button>

      <button
        type="button"
        onClick={() => {
          setPlacing(false);
          setMove(null);
          setEditMode((v) => !v);
        }}
        className={`press glass absolute bottom-60 right-4 z-30 md:bottom-24 grid size-12 place-items-center rounded-2xl ${
          editMode
            ? "bg-primary text-primary-foreground shadow-md"
            : "text-primary bg-background/85 border border-white/20"
        }`}
        aria-label="Edit pin locations"
      >
        <Pencil className="size-5" />
      </button>

      <button
        type="button"
        onClick={() => position && setFocus({ lat: position.lat, lng: position.lng })}
        className="press glass absolute bottom-44 right-4 z-30 md:bottom-8 grid size-12 place-items-center rounded-2xl text-primary bg-background/85 border border-white/20 shadow-md"
        aria-label="Center on my location"
      >
        <Crosshair className="size-5" />
      </button>

      <button
        type="button"
        onClick={() => {
          setEditMode(false);
          setPlacing(true);
          setDraft(position ? { lat: position.lat, lng: position.lng } : { lat: 0, lng: 0 });
        }}
        className="press glass-strong absolute bottom-28 right-4 z-30 md:bottom-8 md:right-20 grid size-14 place-items-center rounded-full text-primary bg-background/95 border border-white/20 shadow-xl"
        aria-label="Add pin"
      >
        <Plus className="size-7" strokeWidth={2.6} />
      </button>

      {/* Active Drawing Mode Toolbar */}
      {drawingMode && (
        <div className="card-surface ios-glass pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl px-5 py-3 bg-background/95 backdrop-blur-xl border border-primary/30 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-primary animate-ping" />
            <p className="text-xs font-semibold text-foreground">
              Drawing {drawingMode === "polygon" ? "Territory Polygon" : "Boundary Polyline"}:{" "}
              {drawingPoints.length} point{drawingPoints.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={cancelDrawing}
              className="h-8 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={drawingPoints.length < (drawingMode === "polygon" ? 3 : 2)}
              onClick={() => setSaveAreaDialogOpen(true)}
              className="h-8 rounded-xl text-xs bg-primary text-primary-foreground font-semibold"
            >
              <Check className="size-3.5 mr-1" />
              Save Territory
            </Button>
          </div>
        </div>
      )}

      {/* Territory Areas Drawer */}
      <Drawer open={territoriesPanelOpen} onOpenChange={setTerritoriesPanelOpen}>
        <DrawerContent className="max-h-[80vh] p-4 sm:p-6 rounded-t-3xl bg-background/95 backdrop-blur-2xl">
          <DrawerHeader className="p-0 pb-3">
            <DrawerTitle className="text-lg font-bold">Territories & Geofencing</DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              Define survey sectors, boundaries, and assign them to Community Health Workers.
            </DrawerDescription>
          </DrawerHeader>

          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setTerritoriesPanelOpen(false);
                setDrawingMode("polygon");
                setDrawingPoints([]);
                toast.info("Tap the map to place polygon vertices. Need at least 3 points.");
              }}
              className="flex-1 rounded-xl text-xs font-semibold"
            >
              <Plus className="size-3.5 mr-1.5" /> Draw Polygon Sector
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTerritoriesPanelOpen(false);
                setDrawingMode("polyline");
                setDrawingPoints([]);
                toast.info("Tap the map to place line points.");
              }}
              className="flex-1 rounded-xl text-xs font-semibold"
            >
              <Plus className="size-3.5 mr-1.5" /> Draw Boundary Line
            </Button>
          </div>

          <div className="mt-4 space-y-2 overflow-y-auto max-h-60 pr-1">
            {areas.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border/50">
                No territory sectors created yet.
              </div>
            ) : (
              areas.map((a) => {
                const assignedUser = teamMembers.find((m) => m.id === a.assigned_chw_id);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-card/60 border border-border/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="size-3.5 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: a.color || "#2563eb" }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {assignedUser ? `Assigned to: ${assignedUser.name}` : "Unassigned"} ·{" "}
                          {a.geometry?.type || "Polygon"}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteArea(a.id)}
                      className="size-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Save Territory Dialog */}
      <Dialog open={saveAreaDialogOpen} onOpenChange={setSaveAreaDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-background/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Save Territory Sector</DialogTitle>
            <DialogDescription>
              Assign a name, display color, and assign this survey territory to a team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Sector Name</label>
              <input
                type="text"
                placeholder="e.g., Ward 4 North Sector"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-card border border-border/70 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Assigned CHW</label>
              <select
                value={newAreaCHW}
                onChange={(e) => setNewAreaCHW(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-card border border-border/70 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Unassigned (Open Sector)</option>
                {teamMembers.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Sector Color</label>
              <div className="flex items-center gap-2">
                {["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setNewAreaColor(col)}
                    className={cn(
                      "size-7 rounded-full transition-all border-2",
                      newAreaColor === col
                        ? "border-foreground scale-110"
                        : "border-transparent opacity-80 hover:opacity-100",
                    )}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSaveAreaDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveArea} className="rounded-xl font-semibold">
              Save Sector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GPS Sharing Permission Prompt Dialog */}
      <Dialog open={gpsPromptOpen} onOpenChange={setGpsPromptOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-background/95 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Radio className="size-5 text-emerald-600 animate-pulse" />
              Enable Live GPS Location Sharing
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Your real-time GPS position will be shared with supervisors and team administrators
              during active household survey sessions to coordinate field coverage and safety.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-foreground space-y-1.5">
            <p className="font-semibold text-primary">Privacy & Safety Notice:</p>
            <p className="text-muted-foreground text-[11px]">
              Location coordinates are only streamed while the PWA is open. You can pause or stop
              location sharing anytime using the GPS toggle button.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setGpsPromptOpen(false)}
              className="rounded-xl text-xs"
            >
              Decline
            </Button>
            <Button
              onClick={() => {
                setGpsSharingEnabled(true);
                localStorage.setItem("NCD_GPS_SHARING", "true");
                setGpsPromptOpen(false);
                toast.success("Live GPS Location Sharing Enabled");
              }}
              className="rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Allow & Start Sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeHouse && (
        <HouseDetailSheet
          house={activeHouse}
          open={!!activeHouse}
          onOpenChange={(o) => !o && setActiveHouse(null)}
          onAddLocation={startHouseLocation}
        />
      )}
      <PinFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (open) setFormOpen(true);
          else {
            setFormOpen(false);
            setPlacing(false);
            setDraft(null);
          }
        }}
        coords={draft}
        accuracy={position?.accuracy ?? null}
        saving={savingHouse}
        onSave={confirmNewPin}
      />
    </div>
  );
}
