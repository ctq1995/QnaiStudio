import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type VersionOperationStatus = 'idle' | 'auto-checkpoint' | 'creating' | 'restoring' | 'deleting';

interface VersioningState {
  autoCheckpointEnabled: boolean;
  operationStatus: VersionOperationStatus;
  operationMessage: string | null;
  lastRestoreNotice: string | null;
  setAutoCheckpointEnabled: (enabled: boolean) => void;
  beginOperation: (status: Exclude<VersionOperationStatus, 'idle'>, message?: string | null) => void;
  finishOperation: () => void;
  failOperation: (message: string) => void;
  setLastRestoreNotice: (message: string | null) => void;
}

export const useVersioningStore = create<VersioningState>()(
  persist(
    (set) => ({
      autoCheckpointEnabled: true,
      operationStatus: 'idle',
      operationMessage: null,
      lastRestoreNotice: null,
      setAutoCheckpointEnabled: (enabled) => set({ autoCheckpointEnabled: enabled }),
      beginOperation: (status, message = null) => set({ operationStatus: status, operationMessage: message }),
      finishOperation: () => set({ operationStatus: 'idle', operationMessage: null }),
      failOperation: (message) => set({ operationStatus: 'idle', operationMessage: message }),
      setLastRestoreNotice: (message) => set({ lastRestoreNotice: message }),
    }),
    {
      name: 'versioning-store',
      partialize: (state) => ({ autoCheckpointEnabled: state.autoCheckpointEnabled }),
    },
  ),
);

