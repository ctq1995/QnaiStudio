import { create } from 'zustand';
import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { engineeringTaskStateService, filterTaskStates, type EngineeringTaskStateFilter } from '../services/engineeringTaskStateService';
import { dispatchEngineeringTaskControlActionWithAudit, type EngineeringTaskControlAuditEvent, type EngineeringTaskControlDispatchResult } from '../services/engineeringTaskControlDispatcher';
import { createNoopEngineeringTaskControlRuntimeBridge, isRuntimeAction, type EngineeringTaskControlRuntimeAckEvent, type EngineeringTaskControlRuntimeBridge } from '../services/engineeringTaskControlRuntimeBridge';
import type { EngineeringTaskControlTranscriptBridge } from '../services/engineeringTaskControlTranscriptBridge';

type EngineeringTaskStateSnapshot = { taskStates?: EngineeringTaskState[] };

export type EngineeringTaskCenterAction = 'pause' | 'resume' | 'cancel' | 'open_transcript' | 'open_timeline';

export interface EngineeringTaskCenterActionRequest {
  taskId: string;
  action: EngineeringTaskCenterAction;
  requestedAt: string;
}

type EngineeringTaskControlStoreAuditEvent = EngineeringTaskControlAuditEvent | EngineeringTaskControlRuntimeAckEvent;

interface EngineeringTaskStateStore {
  taskStates: EngineeringTaskState[];
  activeTaskId?: string;
  filter: EngineeringTaskStateFilter;
  lastActionRequest?: EngineeringTaskCenterActionRequest;
  lastActionResult?: EngineeringTaskControlDispatchResult;
  lastControlAuditEvents: EngineeringTaskControlStoreAuditEvent[];
  lastControlTranscriptError?: string;
  lastControlRuntimeError?: string;
  controlTranscriptBridge?: EngineeringTaskControlTranscriptBridge;
  controlRuntimeBridge?: EngineeringTaskControlRuntimeBridge;
  setTaskStates: (states: EngineeringTaskState[]) => void;
  upsertTaskState: (state: EngineeringTaskState) => void;
  syncFromRuntimeSnapshot: (snapshot: EngineeringTaskStateSnapshot) => void;
  requestTaskAction: (taskId: string, action: EngineeringTaskCenterAction) => void;
  dispatchTaskAction: (taskId: string, action: EngineeringTaskCenterAction) => void;
  setControlTranscriptBridge: (bridge?: EngineeringTaskControlTranscriptBridge) => void;
  setControlRuntimeBridge: (bridge?: EngineeringTaskControlRuntimeBridge) => void;
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
  controlRuntimeBridge: createNoopEngineeringTaskControlRuntimeBridge(),

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
      lastControlTranscriptError: undefined,
      lastControlRuntimeError: undefined,
    });
    void acknowledgeRuntimeControl(get().controlRuntimeBridge, request, dispatch.events, get, set);
  },

  setControlTranscriptBridge: (bridge) => {
    set({ controlTranscriptBridge: bridge, lastControlTranscriptError: undefined });
  },

  setControlRuntimeBridge: (bridge) => {
    set({ controlRuntimeBridge: bridge, lastControlRuntimeError: undefined });
  },

  setFilter: (filter) => {
    set({ filter });
  },

  selectTask: (taskId) => {
    set({ activeTaskId: taskId });
  },

  clear: () => {
    engineeringTaskStateService.clear();
    set({ taskStates: [], activeTaskId: undefined, filter: {}, lastActionRequest: undefined, lastActionResult: undefined, lastControlAuditEvents: [], lastControlTranscriptError: undefined, lastControlRuntimeError: undefined, controlTranscriptBridge: undefined, controlRuntimeBridge: createNoopEngineeringTaskControlRuntimeBridge() });
  },

  getFilteredTaskStates: () => filterTaskStates(get().taskStates, get().filter),

  getActiveTask: () => get().taskStates.find((state) => state.taskId === get().activeTaskId),
}));

function recordControlAuditEvents(
  bridge: EngineeringTaskControlTranscriptBridge | undefined,
  events: EngineeringTaskControlStoreAuditEvent[],
  set: (state: Partial<EngineeringTaskStateStore>) => void,
): void {
  if (!bridge) return;
  bridge.record(events).catch((error: unknown) => {
    set({ lastControlTranscriptError: stringifyError(error) });
  });
}

async function acknowledgeRuntimeControl(
  bridge: EngineeringTaskControlRuntimeBridge | undefined,
  request: EngineeringTaskCenterActionRequest,
  events: EngineeringTaskControlAuditEvent[],
  get: () => EngineeringTaskStateStore,
  set: (state: Partial<EngineeringTaskStateStore>) => void,
): Promise<void> {
  if (!bridge || !isRuntimeAction(request.action)) {
    recordControlAuditEvents(get().controlTranscriptBridge, events, set);
    return;
  }

  try {
    const ack = await bridge.acknowledge(request);
    const nextEvents: EngineeringTaskControlStoreAuditEvent[] = ack ? [...events, ack] : events;
    set({
      lastControlAuditEvents: nextEvents,
      lastControlRuntimeError: undefined,
    });
    recordControlAuditEvents(get().controlTranscriptBridge, nextEvents, set);
  } catch (error: unknown) {
    set({ lastControlRuntimeError: stringifyError(error) });
    recordControlAuditEvents(get().controlTranscriptBridge, events, set);
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Failed to record task control transcript events';
}

export { engineeringTaskStateService } from '../services/engineeringTaskStateService';
export type { EngineeringTaskStateFilter } from '../services/engineeringTaskStateService';
export type { EngineeringTaskControlAuditEvent, EngineeringTaskControlDispatchResult } from '../services/engineeringTaskControlDispatcher';
export type { EngineeringTaskControlRuntimeAckEvent, EngineeringTaskControlRuntimeBridge } from '../services/engineeringTaskControlRuntimeBridge';
