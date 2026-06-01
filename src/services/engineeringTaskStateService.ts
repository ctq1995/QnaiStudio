import type { EngineeringAgentRouteDecision, EngineeringTaskState, EngineeringTaskStatus } from '../ai-runtime/engineering';

export interface EngineeringTaskStateFilter {
  status?: EngineeringTaskStatus | EngineeringTaskStatus[];
  route?: EngineeringAgentRouteDecision['route'] | EngineeringAgentRouteDecision['route'][];
  subtype?: EngineeringAgentRouteDecision['subtype'] | EngineeringAgentRouteDecision['subtype'][];
}

export type EngineeringTaskStateListener = (states: EngineeringTaskState[]) => void;

export interface EngineeringTaskStateService {
  setTaskStates: (states: EngineeringTaskState[]) => void;
  upsertTaskState: (state: EngineeringTaskState) => void;
  getTaskState: (taskId: string) => EngineeringTaskState | undefined;
  getTaskStates: (filter?: EngineeringTaskStateFilter) => EngineeringTaskState[];
  subscribe: (listener: EngineeringTaskStateListener) => () => void;
  clear: () => void;
}

export function createEngineeringTaskStateService(): EngineeringTaskStateService {
  let taskStates: EngineeringTaskState[] = [];
  const listeners = new Set<EngineeringTaskStateListener>();

  const notify = () => {
    const snapshot = cloneAndSortStates(taskStates);
    listeners.forEach((listener) => listener(snapshot));
  };

  return {
    setTaskStates: (states) => {
      taskStates = cloneAndSortStates(states);
      notify();
    },

    upsertTaskState: (state) => {
      const nextState = cloneTaskState(state);
      const index = taskStates.findIndex((item) => item.taskId === state.taskId);
      if (index >= 0) {
        taskStates = taskStates.map((item, itemIndex) => itemIndex === index ? nextState : item);
      } else {
        taskStates = [...taskStates, nextState];
      }
      taskStates = cloneAndSortStates(taskStates);
      notify();
    },

    getTaskState: (taskId) => {
      const state = taskStates.find((item) => item.taskId === taskId);
      return state ? cloneTaskState(state) : undefined;
    },

    getTaskStates: (filter) => filterTaskStates(taskStates, filter).map(cloneTaskState),

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear: () => {
      taskStates = [];
      notify();
    },
  };
}

export const engineeringTaskStateService = createEngineeringTaskStateService();

export function filterTaskStates(states: EngineeringTaskState[], filter?: EngineeringTaskStateFilter): EngineeringTaskState[] {
  return cloneAndSortStates(states).filter((state) => {
    if (!matchesFilterValue(state.status, filter?.status)) return false;
    if (!matchesFilterValue(state.route, filter?.route)) return false;
    if (!matchesFilterValue(state.subtype, filter?.subtype)) return false;
    return true;
  });
}

function matchesFilterValue<T>(value: T | undefined, filterValue: T | T[] | undefined): boolean {
  if (filterValue === undefined) return true;
  if (Array.isArray(filterValue)) return filterValue.includes(value as T);
  return value === filterValue;
}

function cloneAndSortStates(states: EngineeringTaskState[]): EngineeringTaskState[] {
  return states.map(cloneTaskState).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function cloneTaskState(state: EngineeringTaskState): EngineeringTaskState {
  return {
    ...state,
    skippedStages: [...state.skippedStages],
    verificationStrategy: state.verificationStrategy
      ? { ...state.verificationStrategy, commandIds: [...state.verificationStrategy.commandIds] }
      : undefined,
    reviewStrategy: state.reviewStrategy ? { ...state.reviewStrategy } : undefined,
  };
}
