import { describe, expect, it } from 'vitest';
import { decideEngineeringTaskControlPermission } from './engineeringTaskControlPermissionPolicy';

const requestedAt = '2026-06-01T00:00:00.000Z';

describe('engineering task control permission policy', () => {
  it('allows non-destructive control actions', () => {
    const decision = decideEngineeringTaskControlPermission({ taskId: 'task-1', action: 'pause', requestedAt });

    expect(decision).toEqual(expect.objectContaining({
      type: 'task_control_permission_decision',
      taskId: 'task-1',
      action: 'pause',
      status: 'allowed',
      reason: 'policy_allowed',
      requestedAt,
      decidedAt: expect.any(String),
    }));
  });

  it('requires confirmation for cancel by default', () => {
    const decision = decideEngineeringTaskControlPermission({ taskId: 'task-1', action: 'cancel', requestedAt });

    expect(decision).toEqual(expect.objectContaining({
      action: 'cancel',
      status: 'requires_confirmation',
      reason: 'cancel_requires_confirmation',
    }));
  });

  it('can allow cancel when confirmation is disabled by caller policy', () => {
    const decision = decideEngineeringTaskControlPermission(
      { taskId: 'task-1', action: 'cancel', requestedAt },
      { requireCancelConfirmation: false },
    );

    expect(decision).toEqual(expect.objectContaining({
      action: 'cancel',
      status: 'allowed',
      reason: 'policy_allowed',
    }));
  });

  it('denies requests without task id', () => {
    const decision = decideEngineeringTaskControlPermission({ taskId: '   ', action: 'pause', requestedAt });

    expect(decision).toEqual(expect.objectContaining({
      taskId: '   ',
      action: 'pause',
      status: 'denied',
      reason: 'missing_task_id',
    }));
  });
});
