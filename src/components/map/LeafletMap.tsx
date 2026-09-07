import L from "leaflet";
import { createElement, useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import "leaflet/dist/leaflet.css";
import { pinTypeDef, type Pin } from "@/lib/pin-types";
import type { RiskLevel, ClinicalRiskState } from "@/config/risk";
const RISK_META: Record<string, { color: string }> = {
  high: { color: "oklch(0.6 0.22 25)" },
  moderate: { color: "oklch(0.7 0.16 60)" },
  low: { color: "oklch(0.62 0.17 240)" },
  unknown: { color: "oklch(0.6 0 0)" },
  missing: { color: "oklch(0.7 0 0)" },
  invalid: { color: "oklch(0.6 0.22 25)" },
};
import type { GeoPosition } from "@/hooks/useGeolocation";

type MapArea = {
  id: string;
  name: string;
  color: string;
  geometry: any;
  assigned_chw_id?: string | null;
};

type Props = {
  pins: Pin[];
  showPins: boolean;
  position: GeoPosition | null;
  heading: number | null;
  draft: { lat: number; lng: number } | null;
  focus: { lat: number; lng: number; id?: string } | null;
  /** when true, taps place/move the temporary marker instead of doing nothing */
  addMode: boolean;
  /** when true, authorised pins become draggable */
  editMode: boolean;
  /** health risk per House ID (uppercase) — drawn as a coloured ring on the pin */
  riskByHouse?: Record<string, ClinicalRiskState> | undefined;
  /** Optional array of coordinates to draw a route/polyline through (e.g. for TSP RUN mode) */
  route?: { lat: number; lng: number }[] | undefined;
  nearestPinId?: string | null;
  /** Territory map areas */
  areas?: MapArea[] | undefined;
  /** Territory drawing mode */
  drawingMode?: "polygon" | "polyline" | null | undefined;
  drawingPoints?: { lat: number; lng: number }[] | undefined;
  onAddDrawingPoint?: ((pt: { lat: number; lng: number }) => void) | undefined;
  canMove: (pin: Pin) => boolean;
  onMapTap: (latlng: { lat: number; lng: number }) => void;
  onDraftMove: (latlng: { lat: number; lng: number }) => void;
  onSelectPin: (pin: Pin) => void;
  onSelectMany: (pins: Pin[]) => void;
  onPinDragged: (pin: Pin, latlng: { lat: number; lng: number }) => void;
};

function riskRing(level: ClinicalRiskState | RiskLevel | undefined) {
  if (!level || (level as string) === "unknown" || (level as string) === "missing") return "";
  return `box-shadow:0 0 0 3px ${RISK_META[level as string]?.color ?? "transparent"}, 0 6px 16px -4px rgba(10,30,60,0.45);`;
}

function markerHtml(pin: Pin, dim: boolean, risk?: ClinicalRiskState | RiskLevel, isNearest?: boolean) {
  const def = pinTypeDef(pin.pin_type);
  const icon = renderToStaticMarkup(
    createElement(def.icon, { size: 15, color: "white", strokeWidth: 2.4 }),
  );
  let ring = riskRing(risk) || "box-shadow:0 6px 16px -4px rgba(10,30,60,0.45);";
  if (isNearest) {
    ring = "box-shadow:0 0 0 4px #10b981, 0 0 15px 4px rgba(16,185,129,0.5); z-index: 100;";
  }
  return `<div style="
      width:34px;height:34px;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);
      display:grid;place-items:center;background:${def.color};opacity:${dim ? 0.45 : 1};
      border:2px solid rgba(255,255,255,0.92);${ring}">
      <div style="transform:rotate(45deg);display:grid;place-items:center;">${icon}</div>
    </div>`;
}

function stackHtml(pins: Pin[], risk?: ClinicalRiskState | RiskLevel) {
  const def = pinTypeDef(pins[0]!.pin_type);
  const ring = riskRing(risk) || "box-shadow:0 6px 16px -4px rgba(10,30,60,0.45);";
  return `<div style="position:relative;width:38px;height:38px;">
      <div style="position:absolute;inset:0;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);
        background:${def.color};border:2px solid rgba(255,255,255,0.92);${ring}"></div>
      <div style="position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;
        border-radius:999px;background:white;color:#0b2a4a;font-size:11px;font-weight:700;
        display:grid;place-items:center;box-shadow:0 4px 10px -3px rgba(10,30,60,0.5);">${pins.length}</div>
    </div>`;
}

function clusterHtml(count: number) {
  const size = count > 99 ? 48 : count > 9 ? 42 : 36;
  return `<div style="
      width:${size}px;height:${size}px;border-radius:50%;display:grid;place-items:center;
      background:linear-gradient(135deg, oklch(0.58 0.19 259), oklch(0.72 0.15 235));
      color:white;font-weight:700;font-size:${count > 99 ? 12 : 13}px;
      border:3px solid rgba(255,255,255,0.85);
      box-shadow:0 8px 22px -6px rgba(10,30,60,0.5);">${count}</div>`;
}

export default function LeafletMap({
  pins,
  showPins,
  position,
  heading,
  draft,
  focus,
  addMode,
  editMode,
  riskByHouse,
  route,
  nearestPinId,
  areas,
  drawingMode,
  drawingPoints = [],
  onAddDrawingPoint,
  canMove,

  onMapTap,
  onDraftMove,
  onSelectPin,
  onSelectMany,
  onPinDragged,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const areasLayerRef = useRef<L.LayerGroup | null>(null);
  const drawingLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const meRef = useRef<{ marker: L.CircleMarker; circle: L.Circle; cone: L.Marker } | null>(null);
  const draftRef = useRef<L.Marker | null>(null);
  const centeredRef = useRef(false);
  const renderRef = useRef<() => void>(() => {});

  // Latest callbacks/data without re-binding map listeners.
  const tapRef = useRef(onMapTap);
  const selectRef = useRef(onSelectPin);
  const selectManyRef = useRef(onSelectMany);
  const draftMoveRef = useRef(onDraftMove);
  const draggedRef = useRef(onPinDragged);
  const canMoveRef = useRef(canMove);
  const pinsRef = useRef(pins);
  const showRef = useRef(showPins);
  const editRef = useRef(editMode);
  const riskRef = useRef(riskByHouse);
  const nearestPinIdRef = useRef(nearestPinId);
  const drawingModeRef = useRef(drawingMode);
  const addPointRef = useRef(onAddDrawingPoint);

  riskRef.current = riskByHouse;
  tapRef.current = onMapTap;
  selectRef.current = onSelectPin;
  selectManyRef.current = onSelectMany;
  draftMoveRef.current = onDraftMove;
  draggedRef.current = onPinDragged;
  canMoveRef.current = canMove;
  pinsRef.current = pins;
  showRef.current = showPins;
  editRef.current = editMode;
  nearestPinIdRef.current = nearestPinId;
  drawingModeRef.current = drawingMode;
  addPointRef.current = onAddDrawingPoint;

  // ---- map init (once) ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const areasGroup = L.layerGroup().addTo(map);
    areasLayerRef.current = areasGroup;

    const drawGroup = L.layerGroup().addTo(map);
    drawingLayerRef.current = drawGroup;

    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (drawingModeRef.current && addPointRef.current) {
        addPointRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      } else {
        tapRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- areas layer ----
  useEffect(() => {
    const areasGroup = areasLayerRef.current;
    if (!areasGroup) return;
    areasGroup.clearLayers();

    if (!areas || areas.length === 0) return;

    for (const area of areas) {
      if (!area.geometry) continue;
      try {
        const layer = L.geoJSON(area.geometry, {
          style: {
            color: area.color || "#3b82f6",
            weight: 3,
            opacity: 0.8,
            fillColor: area.color || "#3b82f6",
            fillOpacity: 0.18,
          },
        });
        layer.bindTooltip(area.name, {
          permanent: false,
          direction: "center",
          className: "area-tooltip",
        });
        areasGroup.addLayer(layer);
      } catch (err) {
        console.warn("Could not render territory map area:", area.name, err);
      }
    }
  }, [areas]);

  // ---- drawing preview layer ----
  useEffect(() => {
    const drawGroup = drawingLayerRef.current;
    if (!drawGroup) return;
    drawGroup.clearLayers();

    if (!drawingMode || !drawingPoints || drawingPoints.length === 0) return;

    const latlngs = drawingPoints.map((p) => [p.lat, p.lng] as [number, number]);

    // Draw vertex markers
    drawingPoints.forEach((pt) => {
      const vertex = L.circleMarker([pt.lat, pt.lng], {
        radius: 5,
        color: "#2563eb",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 2,
      });
      drawGroup.addLayer(vertex);
    });

    if (drawingPoints.length > 1) {
      if (drawingMode === "polygon" && drawingPoints.length >= 3) {
        const poly = L.polygon(latlngs, {
          color: "#2563eb",
          weight: 2.5,
          dashArray: "6, 6",
          fillColor: "#3b82f6",
          fillOpacity: 0.2,
        });
        drawGroup.addLayer(poly);
      } else {
        const line = L.polyline(latlngs, {
          color: "#2563eb",
          weight: 2.5,
          dashArray: "6, 6",
        });
        drawGroup.addLayer(line);
      }
    }
  }, [drawingMode, drawingPoints]);

  // ---- current location (never removed) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;
    const latlng: [number, number] = [position.lat, position.lng];
    if (!meRef.current) {
      const circle = L.circle(latlng, {
        radius: position.accuracy,
        color: "oklch(0.55 0.2 259)",
        fillColor: "oklch(0.55 0.2 259)",
        fillOpacity: 0.12,
        weight: 1,
        interactive: false,
      }).addTo(map);
      const cone = L.marker(latlng, {
        interactive: false,
        zIndexOffset: -100,
        icon: L.divIcon({ className: "", html: "", iconSize: [0, 0] }),
      }).addTo(map);
      const marker = L.circleMarker(latlng, {
        radius: 8,
        color: "white",
        weight: 3,
        fillColor: "oklch(0.55 0.2 259)",
        fillOpacity: 1,
        interactive: false,
      }).addTo(map);
      meRef.current = { marker, circle, cone };
    } else {
      meRef.current.marker.setLatLng(latlng);
      meRef.current.circle.setLatLng(latlng).setRadius(position.accuracy);
      meRef.current.cone.setLatLng(latlng);
    }
    if (!centeredRef.current) {
      centeredRef.current = true;
      map.flyTo(latlng, 17, { duration: 1.1 });
    }
  }, [position]);

  // ---- heading cone (only when the device reports one) ----
  useEffect(() => {
    const me = meRef.current;
    if (!me) return;
    if (heading == null) {
      me.cone.setIcon(L.divIcon({ className: "", html: "", iconSize: [0, 0] }));
      return;
    }
    me.cone.setIcon(
      L.divIcon({
        className: "",
        iconSize: [56, 56],
        iconAnchor: [28, 28],
        html: `<div style="width:56px;height:56px;transform:rotate(${heading}deg);">
            <div style="width:0;height:0;margin:0 auto;
              border-left:16px solid transparent;border-right:16px solid transparent;
              border-bottom:26px solid rgba(37,99,235,0.35);"></div>
          </div>`,
      }),
    );
  }, [heading, position]);

  // ---- pins + clustering (stable lifecycle, keyed by pin ids) ----
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    let lastKey = "";

    const draw = () => {
      const zoom = map.getZoom();
      const list = showRef.current ? pinsRef.current : [];
      let sig = `${zoom}|${editRef.current ? "e" : ""}|${list.length}|`;
      for (const p of list) sig += `${p.id}:${p.latitude}:${p.longitude}:${p.pin_type};`;
      if (sig === lastKey) return;
      lastKey = sig;

      layer.clearLayers();
      const CELL = 44;
      const exact = 0.000015;
      const groups = new Map<string, Pin[]>();
      for (const pin of list) {
        const pt = map.project([pin.latitude, pin.longitude], zoom);
        const gkey = `${Math.floor(pt.x / CELL)}:${Math.floor(pt.y / CELL)}`;
        const g = groups.get(gkey);
        if (g) g.push(pin);
        else groups.set(gkey, [pin]);
      }

      for (const group of groups.values()) {
        const first = group[0]!;
        const sameSpot =
          group.length > 1 &&
          group.every(
            (p) =>
              Math.abs(p.latitude - first.latitude) < exact &&
              Math.abs(p.longitude - first.longitude) < exact,
          );
        const stacked = sameSpot || (group.length > 1 && zoom >= 19);
        if (group.length === 1 || stacked) {
          const pin = first;
          const risk = riskRef.current?.[(pin.house_id ?? "").trim().toUpperCase()];
          const isNearest = nearestPinIdRef.current === pin.id;
          const draggable = editRef.current && group.length === 1 && canMoveRef.current(pin);
          const marker = L.marker([pin.latitude, pin.longitude], {
            draggable,
            zIndexOffset: isNearest ? 1000 : 0,
            icon: L.divIcon({
              className: "",
              iconSize: [34, 34],
              iconAnchor: [17, 34],
              html: stacked ? stackHtml(group, risk) : markerHtml(pin, false, risk, isNearest),
            }),
          });
          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e as unknown as Event);
            if (stacked) selectManyRef.current(group);
            else selectRef.current(pin);
          });
          if (draggable) {
            marker.on("dragend", () => {
              const p = marker.getLatLng();
              draggedRef.current(pin, { lat: p.lat, lng: p.lng });
            });
          }
          layer.addLayer(marker);
        } else {
          const count = group.length;
          const size = count > 99 ? 48 : count > 9 ? 42 : 36;
          const marker = L.marker([first.latitude, first.longitude], {
            icon: L.divIcon({
              className: "",
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              html: clusterHtml(count),
            }),
          });
          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e as unknown as Event);
            const latlngs = group.map((p) => [p.latitude, p.longitude] as [number, number]);
            map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 19 });
          });
          layer.addLayer(marker);
        }
      }
    };

    renderRef.current = draw;
    draw();

    map.on("zoomend", draw);
    map.on("moveend", draw);
    return () => {
      map.off("zoomend", draw);
      map.off("moveend", draw);
    };
  }, [pins, showPins, editMode, riskByHouse, nearestPinId]);

  // ---- draft marker ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!draft) {
      if (draftRef.current) {
        draftRef.current.remove();
        draftRef.current = null;
      }
      return;
    }
    if (!draftRef.current) {
      const marker = L.marker([draft.lat, draft.lng], {
        draggable: true,
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 36],
          html: `<div style="width:40px;height:40px;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);
            background:linear-gradient(135deg, oklch(0.58 0.19 259), oklch(0.72 0.15 235));
            border:3px solid white;box-shadow:0 10px 26px -6px rgba(10,30,60,0.55);"></div>`,
        }),
      }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        draftMoveRef.current({ lat: p.lat, lng: p.lng });
      });
      draftRef.current = marker;
    } else {
      draftRef.current.setLatLng([draft.lat, draft.lng]);
    }
  }, [draft]);

  // ---- external focus ----
  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.flyTo([focus.lat, focus.lng], 18, { duration: 0.9 });
  }, [focus]);

  // In Add Pin Mode existing markers must not swallow taps meant for placement.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.toggle("add-pin-mode", addMode || Boolean(drawingMode));
  }, [addMode, drawingMode]);

  // ---- route polyline ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!route || route.length < 2) {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      return;
    }

    const latlngs = route.map((p) => L.latLng(p.lat, p.lng));
    if (!polylineRef.current) {
      polylineRef.current = L.polyline(latlngs, {
        color: "oklch(0.6 0.22 25)",
        weight: 4,
        opacity: 0.8,
        dashArray: "8, 8",
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(map);
    } else {
      polylineRef.current.setLatLngs(latlngs);
    }
  }, [route]);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
