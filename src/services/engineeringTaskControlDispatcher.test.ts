import { describe, expect, it } from 'vitest';
import { dispatchEngineeringTaskControlAction, dispatchEngineeringTaskControlActionWithAudit } from './engineeringTaskControlDispatcher';

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

  it('returns requested and dispatched audit events', () => {
    const dispatch = dispatchEngineeringTaskControlActionWithAudit({ taskId: 'task-1', action: 'cancel', requestedAt });

    expect(dispatch.result).toEqual(expect.objectContaining({
      taskId: 'task-1',
      action: 'cancel',
      status: 'accepted',
      reason: 'noop_control_handler',
    }));
    expect(dispatch.events).toEqual([
      {
        type: 'task_control_requested',
        taskId: 'task-1',
        action: 'cancel',
        requestedAt,
      },
      expect.objectContaining({
        type: 'task_control_dispatched',
        taskId: 'task-1',
        action: 'cancel',
        status: 'accepted',
        reason: 'noop_control_handler',
        requestedAt,
        handledAt: expect.any(String),
      }),
    ]);
  });
});
