import type { AIEvent } from '../ai-runtime/event'
import { getEventBus, type EventBus } from '../ai-runtime/event-bus'
import type { EngineeringTranscriptRecorder, EngineeringTranscriptRecordInput, EngineeringTranscriptEventType } from '../ai-runtime/engineering'

export interface AIEventTranscriptAutoWiringInput {
  recorder: EngineeringTranscriptRecorder
  eventBus?: EventBus
  sessionId?: string
  includeUnscoped?: boolean
  filter?: (event: AIEvent) => boolean
  mapPayload?: (event: AIEvent) => unknown
  onError?: (error: unknown) => void
}

export function registerAIEventTranscriptAutoWiring(input: AIEventTranscriptAutoWiringInput): () => void {
  const eventBus = input.eventBus || getEventBus()
  const listener = (event: AIEvent) => {
    if (!shouldRecordEvent(event, input)) return
    void input.recorder.record(mapAIEventToTranscriptInput(event, input)).catch((error) => {
      input.onError?.(error)
    })
  }

  return input.sessionId ? eventBus.onSession(input.sessionId, listener) : eventBus.onAny(listener)
}

function shouldRecordEvent(event: AIEvent, input: AIEventTranscriptAutoWiringInput): boolean {
  if (input.filter && !input.filter(event)) return false
  if (input.sessionId) return event.sessionId === input.sessionId
  return input.includeUnscoped === true || Boolean(event.sessionId)
}

function mapAIEventToTranscriptInput(event: AIEvent, input: AIEventTranscriptAutoWiringInput): EngineeringTranscriptRecordInput<unknown> {
  return {
    type: mapAIEventToTranscriptType(event),
    sessionId: event.sessionId,
    turnId: event.turnId,
    taskId: event.taskId,
    createdAt: new Date(readEventTimestamp(event)).toISOString(),
    payload: input.mapPayload ? input.mapPayload(event) : event,
  }
}

function readEventTimestamp(event: AIEvent): number {
  if ('timestamp' in event && typeof event.timestamp === 'number') return event.timestamp
  if ('time' in event && typeof event.time === 'number') return event.time
  return Date.now()
}

function mapAIEventToTranscriptType(event: AIEvent): EngineeringTranscriptEventType {
  switch (event.type) {
    case 'session_start':
      return 'session_started'
    case 'session_end':
      return 'session_ended'
    case 'tool_call_start':
      return 'tool_call'
    case 'tool_call_output':
    case 'tool_call_end':
      return 'tool_result'
    case 'permission_request':
      return 'permission_decision'
    case 'result':
      return 'turn_completed'
    case 'error':
      return 'turn_failed'
    default:
      return 'note'
  }
}
