import type { EngineeringRunEvent, EngineeringRunEventHandler } from './types'

export function emitEngineeringEvent(handler: EngineeringRunEventHandler | undefined, event: EngineeringRunEvent): void {
  if (!handler) return
  handler(event)
}
