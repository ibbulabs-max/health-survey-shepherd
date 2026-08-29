/** Map configuration: tiles, default view and pin styling. */
export const mapConfig = {
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution: "&copy; OpenStreetMap contributors",
  defaultCenter: [20.5937, 78.9629] as [number, number],
  defaultZoom: 5,
  focusZoom: 17,
  clusterThreshold: 400,
  maxPins: 3000,
  routeProvider: "google" as const,
  routeUrl: (lat: number, lng: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
} as const;
