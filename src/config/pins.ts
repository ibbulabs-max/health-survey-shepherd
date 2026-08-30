/**
 * Pin and Map Feature Catalog Configuration
 * Exactly 20 required pin categories as per specification.
 */

export interface PinTypeConfig {
  id: string;
  label: string;
  category: "residential" | "commercial" | "public" | "land" | "status" | "other";
  color: string; // Hex color for marker icon
  bgColor: string; // Tailwind bg class
  textColor: string; // Tailwind text class
  iconName: string;
}

export const PIN_CATALOG: PinTypeConfig[] = [
  // 1. House
  {
    id: "house",
    label: "House",
    category: "residential",
    color: "#007AFF",
    bgColor: "bg-blue-500",
    textColor: "text-white",
    iconName: "Home",
  },
  // 2. Locked House
  {
    id: "locked_house",
    label: "Locked House",
    category: "status",
    color: "#5856D6",
    bgColor: "bg-indigo-500",
    textColor: "text-white",
    iconName: "Lock",
  },
  // 3. Refused
  {
    id: "refused",
    label: "Refused",
    category: "status",
    color: "#FF3B30",
    bgColor: "bg-rose-500",
    textColor: "text-white",
    iconName: "XCircle",
  },
  // 4. Shop
  {
    id: "shop",
    label: "Shop",
    category: "commercial",
    color: "#FF9500",
    bgColor: "bg-amber-500",
    textColor: "text-white",
    iconName: "Store",
  },
  // 5. Mosque
  {
    id: "mosque",
    label: "Mosque",
    category: "public",
    color: "#34C759",
    bgColor: "bg-emerald-600",
    textColor: "text-white",
    iconName: "Moon",
  },
  // 6. Temple
  {
    id: "temple",
    label: "Temple",
    category: "public",
    color: "#FF9500",
    bgColor: "bg-amber-600",
    textColor: "text-white",
    iconName: "Flame",
  },
  // 7. Church
  {
    id: "church",
    label: "Church",
    category: "public",
    color: "#007AFF",
    bgColor: "bg-blue-600",
    textColor: "text-white",
    iconName: "Cross",
  },
  // 8. School
  {
    id: "school",
    label: "School",
    category: "public",
    color: "#30B0C7",
    bgColor: "bg-teal-500",
    textColor: "text-white",
    iconName: "GraduationCap",
  },
  // 9. College
  {
    id: "college",
    label: "College",
    category: "public",
    color: "#AF52DE",
    bgColor: "bg-purple-600",
    textColor: "text-white",
    iconName: "BookOpen",
  },
  // 10. Hospital
  {
    id: "hospital",
    label: "Hospital",
    category: "public",
    color: "#FF2D55",
    bgColor: "bg-red-500",
    textColor: "text-white",
    iconName: "PlusSquare",
  },
  // 11. Office
  {
    id: "office",
    label: "Office",
    category: "commercial",
    color: "#5856D6",
    bgColor: "bg-indigo-600",
    textColor: "text-white",
    iconName: "Briefcase",
  },
  // 12. Government Office
  {
    id: "government_office",
    label: "Government Office",
    category: "public",
    color: "#0055D4",
    bgColor: "bg-blue-700",
    textColor: "text-white",
    iconName: "Landmark",
  },
  // 13. Apartment
  {
    id: "apartment",
    label: "Apartment",
    category: "residential",
    color: "#5AC8FA",
    bgColor: "bg-sky-500",
    textColor: "text-white",
    iconName: "Building2",
  },
  // 14. Construction
  {
    id: "construction",
    label: "Construction",
    category: "commercial",
    color: "#FF9500",
    bgColor: "bg-amber-500",
    textColor: "text-white",
    iconName: "HardHat",
  },
  // 15. Empty Land
  {
    id: "empty_land",
    label: "Empty Land",
    category: "land",
    color: "#34C759",
    bgColor: "bg-emerald-500",
    textColor: "text-white",
    iconName: "Trees",
  },
  // 16. Park
  {
    id: "park",
    label: "Park",
    category: "public",
    color: "#30D158",
    bgColor: "bg-green-500",
    textColor: "text-white",
    iconName: "TreePine",
  },
  // 17. Hotel
  {
    id: "hotel",
    label: "Hotel",
    category: "commercial",
    color: "#AF52DE",
    bgColor: "bg-purple-500",
    textColor: "text-white",
    iconName: "Bed",
  },
  // 18. Restaurant
  {
    id: "restaurant",
    label: "Restaurant",
    category: "commercial",
    color: "#FF9500",
    bgColor: "bg-orange-500",
    textColor: "text-white",
    iconName: "Utensils",
  },
  // 19. Petrol Pump
  {
    id: "petrol_pump",
    label: "Petrol Pump",
    category: "commercial",
    color: "#FF3B30",
    bgColor: "bg-rose-600",
    textColor: "text-white",
    iconName: "Fuel",
  },
  // 20. Other
  {
    id: "other",
    label: "Other",
    category: "other",
    color: "#8E8E93",
    bgColor: "bg-gray-500",
    textColor: "text-white",
    iconName: "MapPin",
  },
];

export const getPinTypeConfig = (pinType: string | null | undefined): PinTypeConfig => {
  const norm = (pinType ?? "house")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  // Normalization aliases
  let targetId = norm;
  if (norm === "locked") targetId = "locked_house";
  if (norm === "vacant_land" || norm === "land") targetId = "empty_land";
  if (norm === "govt_office") targetId = "government_office";

  const found = PIN_CATALOG.find((p) => p.id === targetId || p.id === norm);
  return (
    found ?? {
      id: "other",
      label: pinType || "Other",
      category: "other",
      color: "#8E8E93",
      bgColor: "bg-gray-500",
      textColor: "text-white",
      iconName: "MapPin",
    }
  );
};
