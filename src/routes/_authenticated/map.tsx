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

import { SharedMap } from "@/components/map/SharedMap";
import { PIN_TYPES, pinTypeDef, pinTypeLabel, distanceMeters, type Pin } from "@/lib/pin-types";
import type { RiskLevel } from "@/config/risk";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { HouseDetailSheet } from "@/components/houses/HouseDetailSheet";
// Using existing components from Management App where appropriate.

const mapSearchSchema = z.object({
  houseId: z.string().optional(),
  filter: z.enum(["today_followups"]).optional(),
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

  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("all");
  const [types, setTypes] = useState<string[]>([]);
  const [showPins, setShowPins] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [houseTerm, setHouseTerm] = useState("");
  const [houseOpen, setHouseOpen] = useState(false);

  const [activeHouse, setActiveHouse] = useState<any | null>(null);
  const [placing, setPlacing] = useState(false);
  const [editMode, setEditMode] = useState(false);

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

      // Filter by team member (if selected in dropdown)
      if (selectedTeamMember !== "all") {
        if (!h.house.mapped_by || h.house.mapped_by !== selectedTeamMember) continue;
      }

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
  }, [houses, selectedTeamMember, types, houseTerm]);

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

  const riskByHouse = useMemo(() => {
    const out: Record<string, RiskLevel> = {};
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
      setNewPinType("house");
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

  async function confirmNewPin() {
    if (!draft) return;
    setSavingHouse(true);
    try {
      const { error } = await supabase.from("houses").insert({
        house_id: `PIN-${Math.floor(Math.random() * 10000)}`,
        latitude: draft.lat,
        longitude: draft.lng,
        pin_type: newPinType,
        address: "Added from Map",
        mapped_by: user?.userId,
      });

      if (error) throw error;

      toast.success("Pin created");
      setPlacing(false);
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
    <div className="relative h-dvh w-full overflow-hidden bg-muted">
      <div className="absolute bottom-0 left-0 right-0 top-0 z-0 md:left-60">
        <SharedMap
          pins={pins}
          showPins={showPins}
          position={position}
          heading={heading}
          draft={draft}
          focus={focus}
          addMode={Boolean(locatingHouse)}
          editMode={editMode}
          riskByHouse={riskByHouse}
          route={route}
          canMove={canMove}
          onMapTap={handleTap}
          onDraftMove={setDraft}
          onSelectPin={handleSelect}
          onSelectMany={handleSelectMany}
          onPinDragged={handleDragged}
        />
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex max-h-dvh flex-col overflow-y-auto px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-40 md:left-60 md:right-auto md:w-[22rem] md:pb-8">
        <div className="card-surface ios-glass pointer-events-auto flex items-center justify-between rounded-3xl px-4 py-3 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
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
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary">
            <MapPin className="size-3.5" />
            {pins.length}
          </span>
        </div>

        <div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-3 py-2.5 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={houseTerm}
              onChange={(e) => {
                setHouseTerm(e.target.value);
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
        </div>

        {teamMembers.length > 0 && (
          <div className="card-surface ios-glass pointer-events-auto mt-2 flex items-center gap-2 rounded-2xl px-3 py-2.5 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <select
              value={selectedTeamMember}
              onChange={(e) => setSelectedTeamMember(e.target.value)}
              className="w-full bg-transparent text-[13px] font-medium outline-none text-foreground"
            >
              <option value="all">All team members</option>
              {teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {placing ? (
          <div className="card-surface ios-glass pointer-events-auto mt-2 rounded-2xl px-4 py-3 bg-background/80 backdrop-blur-xl border border-white/40 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-semibold text-foreground">New Pin Location</p>
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

            <p className="text-[11px] text-muted-foreground mb-3">
              {draft
                ? `${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}`
                : "Tap the map to place your pin"}
            </p>

            <select
              value={newPinType}
              onChange={(e) => setNewPinType(e.target.value)}
              className="w-full bg-card/70 text-[13px] font-medium outline-none text-foreground border border-border rounded-xl px-3 py-2.5 mb-3"
            >
              {PIN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!draft || savingHouse}
              onClick={confirmNewPin}
              className="press w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-60 shadow-md"
            >
              <Check className="size-3.5" />
              Save Pin
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
          className="press absolute bottom-[21rem] right-4 z-30 md:bottom-56 grid h-12 px-5 place-items-center rounded-2xl shadow-lg border bg-background/80 backdrop-blur-xl border-white/40 text-primary font-bold text-sm flex items-center gap-2"
        >
          <Play className="size-4 fill-primary" />
          RUN
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          setPlacing(false);
          setMove(null);
          setEditMode((v) => !v);
        }}
        className={`press glass absolute bottom-60 right-4 z-30 md:bottom-40 grid size-12 place-items-center rounded-2xl ${
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
        className="press glass absolute bottom-44 right-4 z-30 md:bottom-24 grid size-12 place-items-center rounded-2xl text-primary bg-background/85 border border-white/20 shadow-md"
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
        className="press glass-strong absolute bottom-28 right-4 z-30 md:bottom-6 grid size-16 place-items-center rounded-full text-primary bg-background/95 border border-white/20 shadow-xl"
        aria-label="Add pin"
      >
        <Plus className="size-7" strokeWidth={2.6} />
      </button>

      {activeHouse && (
        <HouseDetailSheet
          house={activeHouse}
          open={!!activeHouse}
          onOpenChange={(o) => !o && setActiveHouse(null)}
          onAddLocation={startHouseLocation}
        />
      )}
    </div>
  );
}
