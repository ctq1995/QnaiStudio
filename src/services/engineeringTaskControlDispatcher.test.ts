import { describe, expect, it } from 'vitest';
import { dispatchEngineeringTaskControlAction } from './engineeringTaskControlDispatcher';

const requestedAt = '2026-06-01T00:00:00.000Z';

describe('dispatchEngineeringTaskControlAction', () => {
  it('returns noop accepted result for runtime control actions', () => {
    const result = dispatchEngineeringTaskControlAction({ taskId: 'task-1', action: 'cancel', requestedAt });

    expect(result).toEqual(expect.objectContaining({
      taskId: 'task-1',
      action: 'cancel',
      status: 'accepted',
      reason: 'noop_control_handler',
      requestedAt,
      handledAt: expect.any(String),
    }));
  });

  it('returns navigation pending result for open actions', () => {
    const result = dispatchEngineeringTaskControlAction({ taskId: 'task-1', action: 'open_timeline', requestedAt });

    expect(result).toEqual(expect.objectContaining({
      taskId: 'task-1',
      action: 'open_timeline',
      status: 'accepted',
      reason: 'navigation_pending',
    }));
  });

  it('rejects missing task id', () => {
    const result = dispatchEngineeringTaskControlAction({ taskId: '   ', action: 'pause', requestedAt });

    expect(result).toEqual(expect.objectContaining({
      taskId: '   ',
      action: 'pause',
      status: 'rejected',
      reason: 'missing_task_id',
    }));
  });
});
