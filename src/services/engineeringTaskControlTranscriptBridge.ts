import type { EngineeringTranscriptEvent } from '../ai-runtime/engineering/transcript-recorder';
import type { EngineeringTranscriptRecorder } from '../ai-runtime/engineering/transcript-recorder';
import type { EngineeringTaskControlAuditEvent } from './engineeringTaskControlDispatcher';
import type { EngineeringTaskControlRuntimeAckEvent } from './engineeringTaskControlRuntimeBridge';

export type EngineeringTaskControlTranscriptEvent = EngineeringTaskControlAuditEvent | EngineeringTaskControlRuntimeAckEvent;

export interface EngineeringTaskControlTranscriptContext {
  sessionId?: string;
  turnId?: string;
}

export interface EngineeringTaskControlTranscriptBridge {
  record(events: EngineeringTaskControlTranscriptEvent[]): Promise<EngineeringTranscriptEvent[]>;
}

export async function recordEngineeringTaskControlAuditEvents(
  recorder: EngineeringTranscriptRecorder,
  events: EngineeringTaskControlTranscriptEvent[],
  context: EngineeringTaskControlTranscriptContext = {},
): Promise<EngineeringTranscriptEvent[]> {
  const recorded: EngineeringTranscriptEvent[] = [];
  for (const event of events) {
    recorded.push(await recorder.record({
      type: event.type,
      sessionId: context.sessionId,
      turnId: context.turnId,
      taskId: event.taskId,
      payload: event,
    }));
  }
  return recorded;
}

export function createEngineeringTaskControlTranscriptBridge(
  recorder: EngineeringTranscriptRecorder,
  context: EngineeringTaskControlTranscriptContext = {},
): EngineeringTaskControlTranscriptBridge {
  return {
    record: (events) => recordEngineeringTaskControlAuditEvents(recorder, events, context),
  };
}
