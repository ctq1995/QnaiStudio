import { create } from 'zustand';
import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { engineeringTaskStateService, filterTaskStates, type EngineeringTaskStateFilter } from '../services/engineeringTaskStateService';
import { dispatchEngineeringTaskControlActionWithAudit, type EngineeringTaskControlAuditEvent, type EngineeringTaskControlDispatchResult } from '../services/engineeringTaskControlDispatcher';

type EngineeringTaskStateSnapshot = { taskStates?: EngineeringTaskState[] };

export type EngineeringTaskCenterAction = 'pause' | 'resume' | 'cancel' | 'open_transcript' | 'open_timeline';

export interface EngineeringTaskCenterActionRequest {
  taskId: string;
  action: EngineeringTaskCenterAction;
  requestedAt: string;
}

interface EngineeringTaskStateStore {
  taskStates: EngineeringTaskState[];
  activeTaskId?: string;
  filter: EngineeringTaskStateFilter;
  lastActionRequest?: EngineeringTaskCenterActionRequest;
  lastActionResult?: EngineeringTaskControlDispatchResult;
  lastControlAuditEvents: EngineeringTaskControlAuditEvent[];
  setTaskStates: (states: EngineeringTaskState[]) => void;
  upsertTaskState: (state: EngineeringTaskState) => void;
  syncFromRuntimeSnapshot: (snapshot: EngineeringTaskStateSnapshot) => void;
  requestTaskAction: (taskId: string, action: EngineeringTaskCenterAction) => void;
  dispatchTaskAction: (taskId: string, action: EngineeringTaskCenterAction) => void;
  setFilter: (filter: EngineeringTaskStateFilter) => void;
  selectTask: (taskId: string) => void;
  clear: () => void;
  getFilteredTaskStates: () => EngineeringTaskState[];
  getActiveTask: () => EngineeringTaskState | undefined;
}

export const useEngineeringTaskStateStore = create<EngineeringTaskStateStore>((set, get) => ({
  taskStates: [],
  filter: {},
  lastControlAuditEvents: [],

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

  requestTaskAction: (taskId, action) => {
    set({
      lastActionRequest: {
        taskId,
        action,
        requestedAt: new Date().toISOString(),
      },
    });
  },

  dispatchTaskAction: (taskId, action) => {
    const request: EngineeringTaskCenterActionRequest = {
      taskId,
      action,
      requestedAt: new Date().toISOString(),
    };
    const dispatch = dispatchEngineeringTaskControlActionWithAudit(request);
    set({
      lastActionRequest: request,
      lastActionResult: dispatch.result,
      lastControlAuditEvents: dispatch.events,
    });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  selectTask: (taskId) => {
    set({ activeTaskId: taskId });
  },

  clear: () => {
    engineeringTaskStateService.clear();
    set({ taskStates: [], activeTaskId: undefined, filter: {}, lastActionRequest: undefined, lastActionResult: undefined, lastControlAuditEvents: [] });
  },

  getFilteredTaskStates: () => filterTaskStates(get().taskStates, get().filter),

  getActiveTask: () => get().taskStates.find((state) => state.taskId === get().activeTaskId),
}));

export { engineeringTaskStateService } from '../services/engineeringTaskStateService';
export type { EngineeringTaskStateFilter } from '../services/engineeringTaskStateService';
export type { EngineeringTaskControlAuditEvent, EngineeringTaskControlDispatchResult } from '../services/engineeringTaskControlDispatcher';
