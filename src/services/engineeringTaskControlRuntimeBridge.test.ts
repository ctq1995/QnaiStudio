import { describe, expect, it } from 'vitest';
import { createNoopEngineeringTaskControlRuntimeBridge, isRuntimeAction } from './engineeringTaskControlRuntimeBridge';

const requestedAt = '2026-06-01T00:00:00.000Z';

describe('engineering task control runtime bridge', () => {
  it('acks runtime control actions', async () => {
    const bridge = createNoopEngineeringTaskControlRuntimeBridge();

    await expect(bridge.acknowledge({ taskId: 'task-1', action: 'pause', requestedAt })).resolves.toEqual(expect.objectContaining({
      type: 'task_control_runtime_ack',
      taskId: 'task-1',
      action: 'pause',
      status: 'acknowledged',
      reason: 'noop_runtime_handler',
      requestedAt,
      acknowledgedAt: expect.any(String),
    }));
  });

  it('ignores non-runtime actions', async () => {
    const bridge = createNoopEngineeringTaskControlRuntimeBridge();

    await expect(bridge.acknowledge({ taskId: 'task-1', action: 'open_timeline', requestedAt })).resolves.toBeUndefined();
  });

  it('recognizes runtime action kinds', () => {
    expect(isRuntimeAction('pause')).toBe(true);
    expect(isRuntimeAction('open_transcript')).toBe(false);
  });
});
