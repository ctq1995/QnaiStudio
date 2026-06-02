import { create } from 'zustand';
import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { engineeringTaskStateService, filterTaskStates, type EngineeringTaskStateFilter } from '../services/engineeringTaskStateService';
import { decideEngineeringTaskControlPermission, type EngineeringTaskControlPermissionDecision } from '../services/engineeringTaskControlPermissionPolicy';
import { dispatchEngineeringTaskControlActionWithAudit, type EngineeringTaskControlAuditEvent, type EngineeringTaskControlDispatchResult } from '../services/engineeringTaskControlDispatcher';
import { createNoopEngineeringTaskControlRuntimeBridge, isRuntimeAction, type EngineeringTaskControlRuntimeAckEvent, type EngineeringTaskControlRuntimeBridge } from '../services/engineeringTaskControlRuntimeBridge';
import type { EngineeringTaskControlTranscriptBridge } from '../services/engineeringTaskControlTranscriptBridge';

type EngineeringTaskStateSnapshot = { taskStates?: EngineeringTaskState[] };

export type EngineeringTaskCenterAction = 'pause' | 'resume' | 'cancel' | 'open_transcript' | 'open_timeline';
export type EngineeringTaskNavigationTarget = 'transcript' | 'timeline';

export interface EngineeringTaskNavigationIntent {
  taskId: string;
  target: EngineeringTaskNavigationTarget;
  requestedAt: string;
}

export interface EngineeringTaskCenterActionRequest {
  taskId: string;
  action: EngineeringTaskCenterAction;
  requestedAt: string;
}

type EngineeringTaskControlStoreAuditEvent = EngineeringTaskControlPermissionDecision | EngineeringTaskControlAuditEvent | EngineeringTaskControlRuntimeAckEvent;

interface EngineeringTaskStateStore {
  taskStates: EngineeringTaskState[];
  activeTaskId?: string;
  filter: EngineeringTaskStateFilter;
  lastActionRequest?: EngineeringTaskCenterActionRequest;
  lastActionResult?: EngineeringTaskControlDispatchResult;
  lastControlAuditEvents: EngineeringTaskControlStoreAuditEvent[];
  lastControlPermissionDecision?: EngineeringTaskControlPermissionDecision;
  lastControlTranscriptError?: string;
  lastControlRuntimeError?: string;
  lastNavigationIntent?: EngineeringTaskNavigationIntent;
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
    const permissionDecision = decideEngineeringTaskControlPermission(request);
    if (permissionDecision.status !== 'allowed') {
      set({
        lastActionRequest: request,
        lastActionResult: undefined,
        lastControlAuditEvents: [permissionDecision],
        lastControlPermissionDecision: permissionDecision,
        lastControlTranscriptError: undefined,
        lastControlRuntimeError: undefined,
        lastNavigationIntent: undefined,
      });
      recordControlAuditEvents(get().controlTranscriptBridge, [permissionDecision], set);
      return;
    }

    const dispatch = dispatchEngineeringTaskControlActionWithAudit(request);
    const events: EngineeringTaskControlStoreAuditEvent[] = [permissionDecision, ...dispatch.events];
    const navigationIntent = (action === 'open_transcript' || action === 'open_timeline') && dispatch.result.status === 'accepted'
      ? { taskId, target: action === 'open_transcript' ? 'transcript' as const : 'timeline' as const, requestedAt: request.requestedAt }
      : undefined;
    set({
      lastActionRequest: request,
      lastActionResult: dispatch.result,
      lastControlAuditEvents: events,
      lastControlPermissionDecision: permissionDecision,
      lastControlTranscriptError: undefined,
      lastControlRuntimeError: undefined,
      lastNavigationIntent: navigationIntent,
    });
    void acknowledgeRuntimeControl(get().controlRuntimeBridge, request, dispatch.events, get, set, permissionDecision);
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
    set({ taskStates: [], activeTaskId: undefined, filter: {}, lastActionRequest: undefined, lastActionResult: undefined, lastControlAuditEvents: [], lastControlPermissionDecision: undefined, lastControlTranscriptError: undefined, lastControlRuntimeError: undefined, lastNavigationIntent: undefined, controlTranscriptBridge: undefined, controlRuntimeBridge: createNoopEngineeringTaskControlRuntimeBridge() });
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
  permissionDecision?: EngineeringTaskControlPermissionDecision,
): Promise<void> {
  const baseEvents: EngineeringTaskControlStoreAuditEvent[] = permissionDecision ? [permissionDecision, ...events] : events;
  if (!bridge || !isRuntimeAction(request.action)) {
    recordControlAuditEvents(get().controlTranscriptBridge, baseEvents, set);
    return;
  }

  try {
    const ack = await bridge.acknowledge(request);
    const nextEvents: EngineeringTaskControlStoreAuditEvent[] = ack ? [...baseEvents, ack] : baseEvents;
    set({
      lastControlAuditEvents: nextEvents,
      lastControlRuntimeError: undefined,
    });
    recordControlAuditEvents(get().controlTranscriptBridge, nextEvents, set);
  } catch (error: unknown) {
    set({ lastControlRuntimeError: stringifyError(error) });
    recordControlAuditEvents(get().controlTranscriptBridge, baseEvents, set);
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
export type { EngineeringTaskControlPermissionDecision } from '../services/engineeringTaskControlPermissionPolicy';
export type { EngineeringTaskControlRuntimeAckEvent, EngineeringTaskControlRuntimeBridge } from '../services/engineeringTaskControlRuntimeBridge';
