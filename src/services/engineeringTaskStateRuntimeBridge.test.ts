import { beforeEach, describe, expect, it } from 'vitest';
import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { useEngineeringTaskStateStore } from '../stores/engineeringTaskStateStore';
import {
  createEngineeringTaskStateRuntimeBridge,
  syncEngineeringTaskStateFromRuntime,
  type EngineeringTaskStateRuntimeSnapshot,
} from './engineeringTaskStateRuntimeBridge';

describe('engineeringTaskStateRuntimeBridge', () => {
  beforeEach(() => {
    useEngineeringTaskStateStore.getState().clear();
  });

  it('syncs runtime snapshot task states into a provided store', () => {
    const syncedSnapshots: EngineeringTaskStateRuntimeSnapshot[] = [];
    const runtime = createRuntime([createTaskState({ taskId: 'task-1' })]);

    const ok = syncEngineeringTaskStateFromRuntime(runtime, {
      syncFromRuntimeSnapshot: (snapshot) => syncedSnapshots.push(snapshot),
    });

    expect(ok).toBe(true);
    expect(syncedSnapshots).toEqual([{ taskStates: [createTaskState({ taskId: 'task-1' })] }]);
  });

  it('defaults to useEngineeringTaskStateStore when no store is provided', () => {
    const runtime = createRuntime([createTaskState({ taskId: 'task-store-default' })]);

    const ok = syncEngineeringTaskStateFromRuntime(runtime);

    expect(ok).toBe(true);
    expect(useEngineeringTaskStateStore.getState().taskStates).toEqual([createTaskState({ taskId: 'task-store-default' })]);
  });

  it('returns false when runtime snapshot throws', () => {
    const ok = syncEngineeringTaskStateFromRuntime({
      snapshot: () => {
        throw new Error('snapshot failed');
      },
    });

    expect(ok).toBe(false);
  });

  it('returns false when store sync throws', () => {
    const ok = syncEngineeringTaskStateFromRuntime(createRuntime([]), {
      syncFromRuntimeSnapshot: () => {
        throw new Error('sync failed');
      },
    });

    expect(ok).toBe(false);
  });

  it('creates a reusable bridge with sync()', () => {
    const syncedSnapshots: EngineeringTaskStateRuntimeSnapshot[] = [];
    const bridge = createEngineeringTaskStateRuntimeBridge(createRuntime([createTaskState({ taskId: 'task-bridge' })]), {
      syncFromRuntimeSnapshot: (snapshot) => syncedSnapshots.push(snapshot),
    });

    const ok = bridge.sync();

    expect(ok).toBe(true);
    expect(syncedSnapshots).toEqual([{ taskStates: [createTaskState({ taskId: 'task-bridge' })] }]);
  });
});

function createRuntime(taskStates: EngineeringTaskState[]) {
  return {
    snapshot: () => ({ taskStates }),
  };
}

function createTaskState(overrides: Partial<EngineeringTaskState>): EngineeringTaskState {
  return {
    taskId: 'task-1',
    status: 'completed',
    skippedStages: [],
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}
