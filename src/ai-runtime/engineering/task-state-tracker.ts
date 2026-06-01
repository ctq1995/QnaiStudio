import type { EngineeringAgentRouteDecision } from './agent-router'
import type { EngineeringTurnEvent } from './turn-runner'
import type { EngineeringRunEvent, EngineeringStage } from './types'

export type EngineeringTaskStatus =
  | 'queued'
  | 'running'
  | 'routed'
  | 'context_building'
  | 'executing'
  | 'diffing'
  | 'verifying'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'aborted'

export interface EngineeringTaskVerificationStrategy {
  subtype?: string
  commandIds: string[]
}

export interface EngineeringTaskReviewStrategy {
  subtype?: string
  focus: string
}

export interface EngineeringTaskState {
  taskId: string
  sessionId?: string
  turnId?: string
  status: EngineeringTaskStatus
  currentStage?: EngineeringStage
  route?: EngineeringAgentRouteDecision['route']
  subtype?: EngineeringAgentRouteDecision['subtype']
  riskLevel?: EngineeringAgentRouteDecision['riskLevel']
  permissionMode?: EngineeringAgentRouteDecision['permissionMode']
  skippedStages: EngineeringStage[]
  verificationStrategy?: EngineeringTaskVerificationStrategy
  reviewStrategy?: EngineeringTaskReviewStrategy
  error?: string
  startedAt?: string
  updatedAt: string
  completedAt?: string
}

export interface EngineeringTaskStateTrackerOptions {
  now?: () => string
}

export class EngineeringTaskStateTracker {
  private readonly states = new Map<string, EngineeringTaskState>()
  private readonly now: () => string

  constructor(options: EngineeringTaskStateTrackerOptions = {}) {
    this.now = options.now || (() => new Date().toISOString())
  }

  recordTurnEvent(event: EngineeringTurnEvent): EngineeringTaskState | undefined {
    const taskId = getTurnEventTaskId(event)
    if (!taskId) return undefined

    const state = this.ensureState(taskId, getTurnEventSessionId(event), getTurnEventTurnId(event))
    state.sessionId = getTurnEventSessionId(event) || state.sessionId
    state.turnId = getTurnEventTurnId(event) || state.turnId

    if (event.type === 'turn_started') {
      state.status = 'running'
      state.startedAt = state.startedAt || this.now()
    }

    if (event.type === 'route_decided') {
      state.status = 'routed'
      state.route = event.route
      state.subtype = event.subtype
      state.riskLevel = event.riskLevel
      state.permissionMode = event.permissionMode
      state.skippedStages = mergeStages(state.skippedStages, event.skippedStages.filter(isEngineeringStage))
    }

    if (event.type === 'stage_skipped') {
      state.skippedStages = mergeStages(state.skippedStages, [event.stage])
    }

    if (event.type === 'verification_strategy_selected') {
      state.verificationStrategy = {
        subtype: event.subtype,
        commandIds: [...event.commandIds],
      }
    }

    if (event.type === 'review_strategy_selected') {
      state.reviewStrategy = {
        subtype: event.subtype,
        focus: event.focus,
      }
    }

    if (event.type === 'turn_completed') {
      state.status = 'completed'
      state.completedAt = this.now()
      state.currentStage = undefined
      state.error = undefined
    }

    if (event.type === 'turn_failed') {
      state.status = 'failed'
      state.completedAt = this.now()
      state.currentStage = undefined
      state.error = event.error
    }

    state.updatedAt = this.now()
    return cloneTaskState(state)
  }

  recordRunEvent(event: EngineeringRunEvent): EngineeringTaskState | undefined {
    const taskId = event.taskId
    if (!taskId) return undefined

    const state = this.ensureState(taskId)

    if (event.type === 'stage_started') {
      state.currentStage = event.stage
      state.status = statusFromStage(event.stage)
      state.startedAt = state.startedAt || this.now()
    }

    if (event.type === 'stage_failed') {
      state.currentStage = event.stage
      state.status = 'failed'
      state.error = event.error
      state.completedAt = this.now()
    }

    if (event.type === 'stage_skipped') {
      state.skippedStages = mergeStages(state.skippedStages, [event.stage])
    }

    if (event.type === 'verification_strategy_selected') {
      state.verificationStrategy = {
        subtype: event.subtype,
        commandIds: [...event.commandIds],
      }
    }

    if (event.type === 'review_strategy_selected') {
      state.reviewStrategy = {
        subtype: event.subtype,
        focus: event.focus,
      }
    }

    state.updatedAt = this.now()
    return cloneTaskState(state)
  }

  getTaskState(taskId: string): EngineeringTaskState | undefined {
    const state = this.states.get(taskId)
    return state ? cloneTaskState(state) : undefined
  }

  getAllTaskStates(): EngineeringTaskState[] {
    return [...this.states.values()].map(cloneTaskState)
  }

  reset(): void {
    this.states.clear()
  }

  private ensureState(taskId: string, sessionId?: string, turnId?: string): EngineeringTaskState {
    const existing = this.states.get(taskId)
    if (existing) return existing

    const now = this.now()
    const state: EngineeringTaskState = {
      taskId,
      sessionId,
      turnId,
      status: 'queued',
      skippedStages: [],
      updatedAt: now,
    }
    this.states.set(taskId, state)
    return state
  }
}

function isEngineeringStage(stage: string): stage is EngineeringStage {
  return ['classify', 'context', 'snapshot', 'execute', 'diff', 'verify', 'review', 'summarize'].includes(stage)
}

function statusFromStage(stage: EngineeringStage): EngineeringTaskStatus {
  if (stage === 'context') return 'context_building'
  if (stage === 'execute') return 'executing'
  if (stage === 'diff') return 'diffing'
  if (stage === 'verify') return 'verifying'
  if (stage === 'review') return 'reviewing'
  return 'running'
}

function getTurnEventTaskId(event: EngineeringTurnEvent): string | undefined {
  if ('taskId' in event && typeof event.taskId === 'string') return event.taskId
  if ('turnId' in event && typeof event.turnId === 'string') return event.turnId
  return undefined
}

function getTurnEventSessionId(event: EngineeringTurnEvent): string | undefined {
  if ('sessionId' in event && typeof event.sessionId === 'string') return event.sessionId
  return undefined
}

function getTurnEventTurnId(event: EngineeringTurnEvent): string | undefined {
  if ('turnId' in event && typeof event.turnId === 'string') return event.turnId
  return undefined
}

function mergeStages(existing: EngineeringStage[], incoming: EngineeringStage[]): EngineeringStage[] {
  const merged = new Set(existing)
  for (const stage of incoming) merged.add(stage)
  return [...merged]
}

function cloneTaskState(state: EngineeringTaskState): EngineeringTaskState {
  return {
    ...state,
    skippedStages: [...state.skippedStages],
    verificationStrategy: state.verificationStrategy ? { ...state.verificationStrategy, commandIds: [...state.verificationStrategy.commandIds] } : undefined,
    reviewStrategy: state.reviewStrategy ? { ...state.reviewStrategy } : undefined,
  }
}
