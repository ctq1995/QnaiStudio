import { beforeEach, describe, expect, it } from 'vitest';
import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { useEngineeringTaskStateStore } from './engineeringTaskStateStore';

describe('engineeringTaskStateStore', () => {
  beforeEach(() => {
    useEngineeringTaskStateStore.getState().clear();
  });

  it('syncs task states from runtime snapshot', () => {
    const oldTask = createTaskState({ taskId: 'task-old', updatedAt: '2026-06-01T00:00:00.000Z' });
    const newTask = createTaskState({ taskId: 'task-new', updatedAt: '2026-06-01T00:01:00.000Z' });

    useEngineeringTaskStateStore.getState().syncFromRuntimeSnapshot({ taskStates: [oldTask, newTask] });

    expect(useEngineeringTaskStateStore.getState().taskStates.map((state) => state.taskId)).toEqual(['task-new', 'task-old']);
  });

  it('filters task states by status route and subtype', () => {
    useEngineeringTaskStateStore.getState().setTaskStates([
      createTaskState({ taskId: 'task-1', status: 'reviewing', route: 'review', subtype: 'review.security' }),
      createTaskState({ taskId: 'task-2', status: 'verifying', route: 'verify', subtype: 'verify.lint' }),
    ]);

    useEngineeringTaskStateStore.getState().setFilter({ status: 'reviewing', route: 'review', subtype: 'review.security' });

    expect(useEngineeringTaskStateStore.getState().getFilteredTaskStates().map((state) => state.taskId)).toEqual(['task-1']);
  });

  it('selects active task and upserts task states', () => {
    useEngineeringTaskStateStore.getState().upsertTaskState(createTaskState({ taskId: 'task-1', status: 'running' }));
    useEngineeringTaskStateStore.getState().upsertTaskState(createTaskState({ taskId: 'task-1', status: 'completed', updatedAt: '2026-06-01T00:01:00.000Z' }));
    useEngineeringTaskStateStore.getState().selectTask('task-1');

    expect(useEngineeringTaskStateStore.getState().taskStates).toHaveLength(1);
    expect(useEngineeringTaskStateStore.getState().getActiveTask()).toEqual(expect.objectContaining({
      taskId: 'task-1',
      status: 'completed',
    }));
  });

  it('records and clears task action requests', () => {
    useEngineeringTaskStateStore.getState().requestTaskAction('task-1', 'open_timeline');

    expect(useEngineeringTaskStateStore.getState().lastActionRequest).toEqual(expect.objectContaining({
      taskId: 'task-1',
      action: 'open_timeline',
    }));
    expect(useEngineeringTaskStateStore.getState().lastActionRequest?.requestedAt).toEqual(expect.any(String));

    useEngineeringTaskStateStore.getState().clear();

    expect(useEngineeringTaskStateStore.getState().lastActionRequest).toBeUndefined();
  });

  it('dispatches task actions and records dispatch results', () => {
    useEngineeringTaskStateStore.getState().dispatchTaskAction('task-1', 'cancel');

    expect(useEngineeringTaskStateStore.getState().lastActionRequest).toEqual(expect.objectContaining({
      taskId: 'task-1',
      action: 'cancel',
    }));
    expect(useEngineeringTaskStateStore.getState().lastActionResult).toEqual(expect.objectContaining({
      taskId: 'task-1',
      action: 'cancel',
      status: 'accepted',
      reason: 'noop_control_handler',
    }));
    expect(useEngineeringTaskStateStore.getState().lastControlAuditEvents).toEqual([
      expect.objectContaining({ type: 'task_control_requested', taskId: 'task-1', action: 'cancel' }),
      expect.objectContaining({ type: 'task_control_dispatched', taskId: 'task-1', action: 'cancel', status: 'accepted' }),
    ]);

    useEngineeringTaskStateStore.getState().clear();

    expect(useEngineeringTaskStateStore.getState().lastActionRequest).toBeUndefined();
    expect(useEngineeringTaskStateStore.getState().lastActionResult).toBeUndefined();
    expect(useEngineeringTaskStateStore.getState().lastControlAuditEvents).toEqual([]);
  });

  it('clears store state and handles missing snapshot taskStates', () => {
    useEngineeringTaskStateStore.getState().setTaskStates([createTaskState({ taskId: 'task-1' })]);
    useEngineeringTaskStateStore.getState().selectTask('task-1');
    useEngineeringTaskStateStore.getState().syncFromRuntimeSnapshot({});

    expect(useEngineeringTaskStateStore.getState().taskStates).toEqual([]);

    useEngineeringTaskStateStore.getState().setTaskStates([createTaskState({ taskId: 'task-2' })]);
    useEngineeringTaskStateStore.getState().clear();

    expect(useEngineeringTaskStateStore.getState().taskStates).toEqual([]);
    expect(useEngineeringTaskStateStore.getState().activeTaskId).toBeUndefined();
    expect(useEngineeringTaskStateStore.getState().filter).toEqual({});
  });
});

function createTaskState(overrides: Partial<EngineeringTaskState>): EngineeringTaskState {
  return {
    taskId: 'task-1',
    status: 'running',
    skippedStages: [],
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}
