import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VersioningState {
  autoCheckpointEnabled: boolean;
  setAutoCheckpointEnabled: (enabled: boolean) => void;
}

export const useVersioningStore = create<VersioningState>()(
  persist(
    (set) => ({
      autoCheckpointEnabled: true,
      setAutoCheckpointEnabled: (enabled) => set({ autoCheckpointEnabled: enabled }),
    }),
    {
      name: 'versioning-store',
      partialize: (state) => ({ autoCheckpointEnabled: state.autoCheckpointEnabled }),
    },
  ),
);

