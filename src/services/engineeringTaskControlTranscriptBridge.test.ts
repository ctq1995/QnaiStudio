import { describe, expect, it } from 'vitest';
import { createEngineeringTranscriptRecorder } from '../ai-runtime/engineering/transcript-recorder';
import { dispatchEngineeringTaskControlActionWithAudit } from './engineeringTaskControlDispatcher';
import { createEngineeringTaskControlTranscriptBridge, recordEngineeringTaskControlAuditEvents } from './engineeringTaskControlTranscriptBridge';

const requestedAt = '2026-06-01T00:00:00.000Z';

describe('engineering task control transcript bridge', () => {
  it('records task control audit events into transcript recorder', async () => {
    const recorder = createEngineeringTranscriptRecorder();
    const dispatch = dispatchEngineeringTaskControlActionWithAudit({ taskId: 'task-1', action: 'cancel', requestedAt });

    const recorded = await recordEngineeringTaskControlAuditEvents(recorder, dispatch.events, {
      sessionId: 'session-1',
      turnId: 'turn-1',
    });

    expect(recorded).toHaveLength(2);
    expect(recorded[0]).toEqual(expect.objectContaining({
      type: 'task_control_requested',
      sessionId: 'session-1',
      turnId: 'turn-1',
      taskId: 'task-1',
      payload: dispatch.events[0],
    }));
    expect(recorded[1]).toEqual(expect.objectContaining({
      type: 'task_control_dispatched',
      sessionId: 'session-1',
      turnId: 'turn-1',
      taskId: 'task-1',
      payload: dispatch.events[1],
    }));
    await expect(recorder.getEvents()).resolves.toHaveLength(2);
  });

  it('creates a reusable bridge with fixed transcript context', async () => {
    const recorder = createEngineeringTranscriptRecorder();
    const bridge = createEngineeringTaskControlTranscriptBridge(recorder, { sessionId: 'session-1' });
    const dispatch = dispatchEngineeringTaskControlActionWithAudit({ taskId: 'task-1', action: 'open_timeline', requestedAt });

    const recorded = await bridge.record(dispatch.events);

    expect(recorded).toHaveLength(2);
    expect(recorded[0]).toEqual(expect.objectContaining({
      type: 'task_control_requested',
      sessionId: 'session-1',
      taskId: 'task-1',
    }));
  });
});
