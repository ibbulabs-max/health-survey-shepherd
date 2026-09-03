import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface GlobalFilterState {
  eligibleOnly: boolean;
  supervisorId: string | null;
  chwId: string | null;

  setEligibleOnly: (eligibleOnly: boolean) => void;
  setSupervisorId: (supervisorId: string | null) => void;
  setChwId: (chwId: string | null) => void;
  resetRoleFilters: () => void;
}

export const useGlobalFilter = create<GlobalFilterState>()(
  persist(
    (set) => ({
      eligibleOnly: true, // Default to true per requirements
      supervisorId: null,
      chwId: null,

      setEligibleOnly: (eligibleOnly) => set({ eligibleOnly }),
      setSupervisorId: (supervisorId) => set({ supervisorId, chwId: null }), // Reset CHW when supervisor changes
      setChwId: (chwId) => set({ chwId }),
      resetRoleFilters: () => set({ supervisorId: null, chwId: null }),
    }),
    {
      name: "global-filter-storage",
    },
  ),
);
