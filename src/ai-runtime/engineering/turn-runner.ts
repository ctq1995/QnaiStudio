import { EngineeringExecutionPipeline } from './execution-pipeline'
import type { EngineeringExecutionPipelineDeps } from './execution-pipeline'
import type { EngineeringRunInput, EngineeringRunSummary } from './types'

export type EngineeringAgentSessionStatus = 'idle' | 'running' | 'failed' | 'aborted'

export interface EngineeringTurnInput extends EngineeringRunInput {
  sessionId: string
  turnId?: string
}

export interface EngineeringTurnResult {
  sessionId: string
  turnId: string
  status: EngineeringAgentSessionStatus
  summary?: EngineeringRunSummary
  error?: string
}

export type EngineeringTurnEvent =
  | { type: 'turn_started'; sessionId: string; turnId: string }
  | { type: 'turn_completed'; sessionId: string; turnId: string; success: boolean }
  | { type: 'turn_failed'; sessionId: string; turnId: string; error: string }

export type EngineeringTurnEventHandler = (event: EngineeringTurnEvent) => void

export interface EngineeringTurnRunnerDeps {
  pipeline: EngineeringExecutionPipeline
  onTurnEvent?: EngineeringTurnEventHandler
  createTurnId?: () => string
}

export class EngineeringTurnRunner {
  constructor(private readonly deps: EngineeringTurnRunnerDeps) {}

  static fromPipelineDeps(deps: EngineeringExecutionPipelineDeps, options: Omit<EngineeringTurnRunnerDeps, 'pipeline'> = {}): EngineeringTurnRunner {
    return new EngineeringTurnRunner(createEngineeringTurnRunnerDepsFromPipelineDeps(deps, options))
  }

  async run(input: EngineeringTurnInput): Promise<EngineeringTurnResult> {
    const turnId = input.turnId || this.deps.createTurnId?.() || createDefaultTurnId()
    this.emit({ type: 'turn_started', sessionId: input.sessionId, turnId })

    try {
      const summary = await this.deps.pipeline.run({ ...input, taskId: input.taskId || turnId })
      const result: EngineeringTurnResult = {
        sessionId: input.sessionId,
        turnId,
        status: summary.success ? 'idle' : 'failed',
        summary,
        error: summary.success ? undefined : summary.finalMessage,
      }
      if (!summary.success) {
        this.emit({ type: 'turn_failed', sessionId: input.sessionId, turnId, error: summary.finalMessage })
        return result
      }

      this.emit({ type: 'turn_completed', sessionId: input.sessionId, turnId, success: true })
      return result
    } catch (error) {
      const message = stringifyError(error)
      this.emit({ type: 'turn_failed', sessionId: input.sessionId, turnId, error: message })
      throw error
    }
  }

  private emit(event: EngineeringTurnEvent): void {
    this.deps.onTurnEvent?.(event)
  }
}

export function createEngineeringTurnRunnerDepsFromPipelineDeps(
  deps: EngineeringExecutionPipelineDeps,
  options: Omit<EngineeringTurnRunnerDeps, 'pipeline'> = {},
): EngineeringTurnRunnerDeps {
  return {
    ...options,
    pipeline: new EngineeringExecutionPipeline(deps),
  }
}

export function createDefaultTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
