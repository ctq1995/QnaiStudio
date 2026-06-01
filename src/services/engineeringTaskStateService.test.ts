import { describe, expect, it } from 'vitest';
import type { EngineeringTaskState } from '../ai-runtime/engineering';
import { createEngineeringTaskStateService } from './engineeringTaskStateService';

describe('engineeringTaskStateService', () => {
  it('sets, sorts, gets, and filters task states', () => {
    const service = createEngineeringTaskStateService();
    const oldTask = createTaskState({ taskId: 'task-old', status: 'completed', route: 'review', updatedAt: '2026-06-01T00:00:00.000Z' });
    const newTask = createTaskState({ taskId: 'task-new', status: 'reviewing', route: 'review', subtype: 'review.security', updatedAt: '2026-06-01T00:01:00.000Z' });

    service.setTaskStates([oldTask, newTask]);

    expect(service.getTaskStates().map((state) => state.taskId)).toEqual(['task-new', 'task-old']);
    expect(service.getTaskState('task-new')).toEqual(newTask);
    expect(service.getTaskStates({ status: 'reviewing' })).toEqual([newTask]);
    expect(service.getTaskStates({ route: 'review', subtype: 'review.security' })).toEqual([newTask]);
  });

  it('upserts task states and preserves immutable snapshots', () => {
    const service = createEngineeringTaskStateService();
    const task = createTaskState({ taskId: 'task-1', status: 'running', updatedAt: '2026-06-01T00:00:00.000Z' });

    service.upsertTaskState(task);
    const snapshot = service.getTaskState('task-1');
    snapshot?.skippedStages.push('execute');

    const updated = createTaskState({ taskId: 'task-1', status: 'completed', updatedAt: '2026-06-01T00:01:00.000Z' });
    service.upsertTaskState(updated);

    expect(service.getTaskStates()).toEqual([updated]);
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const service = createEngineeringTaskStateService();
    const notifications: string[][] = [];
    const unsubscribe = service.subscribe((states) => notifications.push(states.map((state) => state.taskId)));

    service.setTaskStates([createTaskState({ taskId: 'task-1' })]);
    unsubscribe();
    service.setTaskStates([createTaskState({ taskId: 'task-2' })]);

    expect(notifications).toEqual([['task-1']]);
  });

  it('clears task states', () => {
    const service = createEngineeringTaskStateService();
    service.setTaskStates([createTaskState({ taskId: 'task-1' })]);

    service.clear();

    expect(service.getTaskStates()).toEqual([]);
    expect(service.getTaskState('task-1')).toBeUndefined();
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
