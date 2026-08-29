/**
 * Referral Destinations Configuration
 * Supports dynamic admin management and default facilities.
 */

export interface ReferralDestination {
  id: string;
  name: string;
  type: "hospital" | "chc" | "phc" | "clinic" | "other";
  address: string;
  phone?: string;
  active: boolean;
}

export const DEFAULT_REFERRAL_DESTINATIONS: ReferralDestination[] = [
  { id: "dest_1", name: "District Government Hospital", type: "hospital", address: "Civil Lines, Main Road", active: true },
  { id: "dest_2", name: "Community Health Center (CHC)", type: "chc", address: "Sector 4, Central Area", active: true },
  { id: "dest_3", name: "Primary Health Center (PHC)", type: "phc", address: "Ward 2, Village Road", active: true },
  { id: "dest_4", name: "Urban Family Welfare Center", type: "clinic", address: "Sub-district Center", active: true },
  { id: "dest_other", name: "Other Hospital / Private Clinic", type: "other", address: "As specified in notes", active: true },
];

const LOCAL_STORAGE_KEY = "management_app_referral_destinations";

export function getReferralDestinations(): ReferralDestination[] {
  if (typeof window === "undefined") return DEFAULT_REFERRAL_DESTINATIONS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_REFERRAL_DESTINATIONS;
    const parsed = JSON.parse(raw) as ReferralDestination[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REFERRAL_DESTINATIONS;
  } catch {
    return DEFAULT_REFERRAL_DESTINATIONS;
  }
}

export function saveReferralDestinations(destinations: ReferralDestination[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(destinations));
}
