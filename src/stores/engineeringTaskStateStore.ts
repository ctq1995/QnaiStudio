import { create } from 'zustand';
import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { engineeringTaskStateService, filterTaskStates, type EngineeringTaskStateFilter } from '../services/engineeringTaskStateService';

type EngineeringTaskStateSnapshot = { taskStates?: EngineeringTaskState[] };

interface EngineeringTaskStateStore {
  taskStates: EngineeringTaskState[];
  activeTaskId?: string;
  filter: EngineeringTaskStateFilter;
  setTaskStates: (states: EngineeringTaskState[]) => void;
  upsertTaskState: (state: EngineeringTaskState) => void;
  syncFromRuntimeSnapshot: (snapshot: EngineeringTaskStateSnapshot) => void;
  setFilter: (filter: EngineeringTaskStateFilter) => void;
  selectTask: (taskId: string) => void;
  clear: () => void;
  getFilteredTaskStates: () => EngineeringTaskState[];
  getActiveTask: () => EngineeringTaskState | undefined;
}

export const useEngineeringTaskStateStore = create<EngineeringTaskStateStore>((set, get) => ({
  taskStates: [],
  filter: {},

  setTaskStates: (states) => {
    engineeringTaskStateService.setTaskStates(states);
    set({ taskStates: engineeringTaskStateService.getTaskStates() });
  },

  upsertTaskState: (state) => {
    engineeringTaskStateService.upsertTaskState(state);
    set({ taskStates: engineeringTaskStateService.getTaskStates() });
  },

  syncFromRuntimeSnapshot: (snapshot) => {
    const states = snapshot.taskStates ?? [];
    engineeringTaskStateService.setTaskStates(states);
    set({ taskStates: engineeringTaskStateService.getTaskStates() });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  selectTask: (taskId) => {
    set({ activeTaskId: taskId });
  },

  clear: () => {
    engineeringTaskStateService.clear();
    set({ taskStates: [], activeTaskId: undefined, filter: {} });
  },

  getFilteredTaskStates: () => filterTaskStates(get().taskStates, get().filter),

  getActiveTask: () => get().taskStates.find((state) => state.taskId === get().activeTaskId),
}));

export { engineeringTaskStateService } from '../services/engineeringTaskStateService';
export type { EngineeringTaskStateFilter } from '../services/engineeringTaskStateService';
