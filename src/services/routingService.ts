import type { HouseMember } from "@/db/types";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteFeature {
  geometry: string | [number, number][]; // polyline string or array of coordinates
  distance: number;
  duration: number;
}

/**
 * Gets a road-based optimized route using the public OSRM server.
 * OSRM's "trip" service calculates a TSP (Traveling Salesperson) optimized route
 * and returns the road polyline.
 *
 * NOTE: The public OSRM server (router.project-osrm.org) is rate-limited and
 * should be used responsibly. In production, a dedicated OSRM instance or Mapbox API
 * is recommended.
 */
export async function getOptimizedRoute(locations: LatLng[]): Promise<RouteFeature | null> {
  if (locations.length < 2) return null;

  // Format: lng,lat;lng,lat...
  const coords = locations.map((loc) => `${loc.lng},${loc.lat}`).join(";");

  try {
    // We use the "trip" service to get an optimized TSP route that returns to start (roundtrip=true)
    // or roundtrip=false if we just want an optimal path. We use roundtrip=false for followups.
    const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=false&source=first&destination=last&geometries=geojson&overview=full`;

    const response = await fetch(url, {
      // Be nice to the public server
      headers: { "User-Agent": "ManagementApp/1.0" },
    });

    if (!response.ok) {
      console.warn("OSRM routing failed:", response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data.code === "Ok" && data.trips && data.trips.length > 0) {
      const trip = data.trips[0];
      return {
        // The geometry from GeoJSON is an array of [lng, lat]. Leaflet expects [lat, lng].
        geometry: trip.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]),
        distance: trip.distance,
        duration: trip.duration,
      };
    }

    return null;
  } catch (error) {
    console.warn("Error fetching OSRM route:", error);
    return null;
  }
}

/**
 * Fallback local TSP using a simple nearest-neighbor heuristic with straight-line distance (Haversine).
 */
export function getLocalTspRoute(locations: LatLng[]): LatLng[] {
  if (locations.length < 2) return locations;

  const unvisited = [...locations];
  const route: LatLng[] = [];

  // Start at the first location
  let current = unvisited.shift()!;
  route.push(current);

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistance(current, unvisited[i]!);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    current = unvisited.splice(nearestIdx, 1)[0]!;
    route.push(current);
  }

  return route;
}

/** Haversine formula for distance in meters */
export function calculateDistance(a: LatLng, b: LatLng): number {
  const R = 6371e3; // metres
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return R * c;
}
