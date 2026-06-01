import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { useEngineeringTaskStateStore } from '../stores/engineeringTaskStateStore';

export interface EngineeringTaskStateRuntimeSnapshot {
  taskStates?: EngineeringTaskState[];
}

export interface EngineeringTaskStateRuntimeLike {
  snapshot: () => EngineeringTaskStateRuntimeSnapshot;
}

export interface EngineeringTaskStateStoreLike {
  syncFromRuntimeSnapshot: (snapshot: EngineeringTaskStateRuntimeSnapshot) => void;
}

export interface EngineeringTaskStateRuntimeBridge {
  sync: () => boolean;
}

export function syncEngineeringTaskStateFromRuntime(
  runtime: EngineeringTaskStateRuntimeLike,
  store: EngineeringTaskStateStoreLike = useEngineeringTaskStateStore.getState(),
): boolean {
  try {
    const snapshot = runtime.snapshot();
    store.syncFromRuntimeSnapshot(snapshot);
    return true;
  } catch {
    return false;
  }
}

export function createEngineeringTaskStateRuntimeBridge(
  runtime: EngineeringTaskStateRuntimeLike,
  store?: EngineeringTaskStateStoreLike,
): EngineeringTaskStateRuntimeBridge {
  return {
    sync: () => syncEngineeringTaskStateFromRuntime(runtime, store),
  };
}
