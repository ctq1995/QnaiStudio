import type { EngineeringTranscriptRecorder } from '../ai-runtime/engineering'
import { mapBridgeEventToTranscriptInput, type EngineeringRuntimeBridgeEvent } from '../ai-runtime/engineering'

export type EngineeringRuntimeBridgeUnsubscribe = () => void
export type EngineeringRuntimeBridgeSubscribe = (handler: (event: EngineeringRuntimeBridgeEvent) => void) => EngineeringRuntimeBridgeUnsubscribe

export interface EngineeringRuntimeBridgeTranscriptInput {
  recorder: EngineeringTranscriptRecorder
  subscribe: EngineeringRuntimeBridgeSubscribe
  onError?: (error: unknown) => void
}

export function registerEngineeringRuntimeBridgeTranscript(input: EngineeringRuntimeBridgeTranscriptInput): EngineeringRuntimeBridgeUnsubscribe {
  return input.subscribe((event) => {
    void input.recorder.record(mapBridgeEventToTranscriptInput(event)).catch((error) => {
      input.onError?.(error)
    })
  })
}
