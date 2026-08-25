/** Branding, navigation and global UI defaults. Change here, changes everywhere. */
export const appConfig = {
  name: "Management App",
  shortName: "Management",
  builtBy: "Built by Ibrahim Labs",
  description:
    "Household mapping, member screening, vitals analytics and follow-up management for community health teams.",
  themeColor: "#1668e3",
  pagination: { defaultPageSize: 25, pageSizeOptions: [25, 50, 100, 250] },
  search: { debounceMs: 250, minChars: 1 },
} as const;

export const featureFlags = {
  map: true,
  smartImport: true,
  followUps: true,
  analytics: true,
  reports: true,
  notifications: true,
  dataQuality: true,
} as const;
