import type { EngineeringLifecycleEvent } from './lifecycle-runtime'
import type { EngineeringTurnEvent } from './turn-runner'

export type EngineeringTranscriptEventType =
  | 'session_started'
  | 'session_ended'
  | 'turn_started'
  | 'turn_completed'
  | 'turn_failed'
  | 'lifecycle_event'
  | 'tool_call'
  | 'tool_result'
  | 'permission_decision'
  | 'verification_result'
  | 'review_result'
  | 'route_decision'
  | 'stage_skipped'
  | 'verification_strategy'
  | 'review_strategy'
  | 'note'

export interface EngineeringTranscriptEvent<TPayload = unknown> {
  id: string
  sequence: number
  type: EngineeringTranscriptEventType
  sessionId?: string
  turnId?: string
  taskId?: string
  createdAt: string
  payload?: TPayload
}

export type EngineeringTranscriptRecordInput<TPayload = unknown> = Omit<EngineeringTranscriptEvent<TPayload>, 'id' | 'createdAt' | 'sequence'> & {
  id?: string
  createdAt?: string
  sequence?: number
}

export interface EngineeringTranscriptWriter {
  write(event: EngineeringTranscriptEvent): void | Promise<void>
  read?(): EngineeringTranscriptEvent[] | Promise<EngineeringTranscriptEvent[]>
  clear?(): void | Promise<void>
}

export interface EngineeringTranscriptRecorderDeps {
  writer?: EngineeringTranscriptWriter
  createEventId?: () => string
}

export interface EngineeringTranscriptSnapshot {
  events: EngineeringTranscriptEvent[]
}

export class InMemoryEngineeringTranscriptWriter implements EngineeringTranscriptWriter {
  private readonly events: EngineeringTranscriptEvent[] = []

  write(event: EngineeringTranscriptEvent): void {
    this.events.push(cloneTranscriptEvent(event))
  }

  read(): EngineeringTranscriptEvent[] {
    return this.events.map(cloneTranscriptEvent)
  }

  clear(): void {
    this.events.length = 0
  }
}

export class EngineeringTranscriptRecorder {
  private nextSequence = 1
  private readonly writer: EngineeringTranscriptWriter
  private readonly createEventId: () => string

  constructor(deps: EngineeringTranscriptRecorderDeps = {}) {
    this.writer = deps.writer || new InMemoryEngineeringTranscriptWriter()
    this.createEventId = deps.createEventId || createDefaultTranscriptEventId
  }

  async record<TPayload = unknown>(input: EngineeringTranscriptRecordInput<TPayload>): Promise<EngineeringTranscriptEvent<TPayload>> {
    const sequence = input.sequence ?? this.allocateSequence()
    this.advanceSequenceAfterExplicitInput(input.sequence)
    const event: EngineeringTranscriptEvent<TPayload> = {
      ...input,
      id: input.id || this.createEventId(),
      sequence,
      createdAt: input.createdAt || new Date().toISOString(),
    }
    await this.writer.write(event)
    return cloneTranscriptEvent(event)
  }

  async recordLifecycleEvent(event: EngineeringLifecycleEvent): Promise<EngineeringTranscriptEvent<EngineeringLifecycleEvent>> {
    return this.record({
      type: mapLifecycleEventType(event),
      sessionId: event.sessionId,
      turnId: event.turnId,
      taskId: event.taskId,
      createdAt: event.createdAt,
      payload: event,
    })
  }

  async recordTurnEvent(event: EngineeringTurnEvent): Promise<EngineeringTranscriptEvent<EngineeringTurnEvent>> {
    return this.record({
      type: mapTurnEventType(event),
      sessionId: event.sessionId,
      turnId: event.turnId,
      payload: event,
    })
  }

  async getEvents(): Promise<EngineeringTranscriptEvent[]> {
    if (!this.writer.read) return []
    const events = await this.writer.read()
    return events.map(cloneTranscriptEvent)
  }

  async snapshot(): Promise<EngineeringTranscriptSnapshot> {
    return { events: await this.getEvents() }
  }

  async clear(): Promise<void> {
    await this.writer.clear?.()
    this.nextSequence = 1
  }

  private allocateSequence(): number {
    const sequence = this.nextSequence
    this.nextSequence += 1
    return sequence
  }

  private advanceSequenceAfterExplicitInput(sequence: number | undefined): void {
    if (sequence === undefined) return
    this.nextSequence = Math.max(this.nextSequence, sequence + 1)
  }
}

export function createEngineeringTranscriptRecorder(deps: EngineeringTranscriptRecorderDeps = {}): EngineeringTranscriptRecorder {
  return new EngineeringTranscriptRecorder(deps)
}

export function createDefaultTranscriptEventId(): string {
  return `transcript-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function mapLifecycleEventType(event: EngineeringLifecycleEvent): EngineeringTranscriptEventType {
  if (event.type === 'SessionStart') return 'session_started'
  if (event.type === 'SessionEnd') return 'session_ended'
  if (event.type === 'TurnStart') return 'turn_started'
  if (event.type === 'TurnEnd') return event.payload.success ? 'turn_completed' : 'turn_failed'
  if (event.type === 'BeforeTool') return 'tool_call'
  if (event.type === 'AfterTool') return 'tool_result'
  if (event.type === 'AfterVerify') return 'verification_result'
  return 'lifecycle_event'
}

function mapTurnEventType(event: EngineeringTurnEvent): EngineeringTranscriptEventType {
  if (event.type === 'turn_started') return 'turn_started'
  if (event.type === 'route_decided') return 'route_decision'
  if (event.type === 'stage_skipped') return 'stage_skipped'
  if (event.type === 'verification_strategy_selected') return 'verification_strategy'
  if (event.type === 'review_strategy_selected') return 'review_strategy'
  if (event.type === 'turn_completed') return 'turn_completed'
  return 'turn_failed'
}

export function cloneTranscriptEvent<TPayload>(event: EngineeringTranscriptEvent<TPayload>): EngineeringTranscriptEvent<TPayload> {
  return cloneJsonValue(event)
}

function cloneJsonValue<TValue>(value: TValue): TValue {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as TValue
}
