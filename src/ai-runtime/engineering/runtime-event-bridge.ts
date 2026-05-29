import type { EngineeringTranscriptRecordInput } from './transcript-recorder'

export type EngineeringRuntimeBridgeEvent =
  | { type: 'model_stream_started'; sessionId?: string; turnId?: string; taskId?: string; model?: string; createdAt?: string }
  | { type: 'model_stream_delta'; sessionId?: string; turnId?: string; taskId?: string; delta: string; createdAt?: string }
  | { type: 'model_stream_completed'; sessionId?: string; turnId?: string; taskId?: string; createdAt?: string }
  | { type: 'tool_call_started'; sessionId?: string; turnId?: string; taskId?: string; toolCallId?: string; toolName: string; createdAt?: string }
  | { type: 'tool_call_completed'; sessionId?: string; turnId?: string; taskId?: string; toolCallId?: string; toolName: string; success: boolean; error?: string; createdAt?: string }
  | { type: 'permission_requested'; sessionId?: string; turnId?: string; taskId?: string; toolCallId?: string; toolName?: string; reason?: string; createdAt?: string }
  | { type: 'permission_resolved'; sessionId?: string; turnId?: string; taskId?: string; toolCallId?: string; decision: 'allow' | 'deny' | 'ask'; reason?: string; createdAt?: string }
  | { type: 'runtime_error'; sessionId?: string; turnId?: string; taskId?: string; error: string; createdAt?: string }

export function mapBridgeEventToTranscriptInput(event: EngineeringRuntimeBridgeEvent): EngineeringTranscriptRecordInput<EngineeringRuntimeBridgeEvent> {
  return {
    type: mapBridgeEventType(event),
    sessionId: event.sessionId,
    turnId: event.turnId,
    taskId: event.taskId,
    createdAt: event.createdAt,
    payload: event,
  }
}

function mapBridgeEventType(event: EngineeringRuntimeBridgeEvent): EngineeringTranscriptRecordInput['type'] {
  if (event.type === 'tool_call_started') return 'tool_call'
  if (event.type === 'tool_call_completed') return 'tool_result'
  if (event.type === 'permission_requested' || event.type === 'permission_resolved') return 'permission_decision'
  return 'note'
}
