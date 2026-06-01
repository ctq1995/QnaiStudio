import type { EngineeringTranscriptRecorder } from '../ai-runtime/engineering'
import { mapBridgeEventToTranscriptInput, type EngineeringRuntimeBridgeEvent } from '../ai-runtime/engineering'
import { createTranscriptPayloadPolicy, type TranscriptPayloadPolicy } from './transcriptPayloadPolicy'

export type EngineeringRuntimeBridgeUnsubscribe = () => void
export type EngineeringRuntimeBridgeSubscribe = (handler: (event: EngineeringRuntimeBridgeEvent) => void) => EngineeringRuntimeBridgeUnsubscribe

export interface EngineeringRuntimeBridgeTranscriptInput {
  recorder: EngineeringTranscriptRecorder
  subscribe: EngineeringRuntimeBridgeSubscribe
  filter?: (event: EngineeringRuntimeBridgeEvent) => boolean
  mapPayload?: (event: EngineeringRuntimeBridgeEvent) => unknown
  payloadPolicy?: TranscriptPayloadPolicy
  onError?: (error: unknown) => void
}

export function registerEngineeringRuntimeBridgeTranscript(input: EngineeringRuntimeBridgeTranscriptInput): EngineeringRuntimeBridgeUnsubscribe {
  return input.subscribe((event) => {
    if (input.filter && !input.filter(event)) return
    const recordInput = mapBridgeEventToTranscriptInput(event)
    const payload = input.mapPayload ? input.mapPayload(event) : recordInput.payload
    const policy = input.payloadPolicy || createTranscriptPayloadPolicy()
    const result = policy(payload)
    void input.recorder.record({
      ...recordInput,
      payload: result.actions.length > 0 ? { payload: result.payload, policy: { actions: result.actions } } : result.payload,
    }).catch((error) => {
      input.onError?.(error)
    })
  })
}
