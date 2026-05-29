import type { EngineeringAgentSessionStatus, EngineeringTurnInput, EngineeringTurnResult, EngineeringTurnRunner } from './turn-runner'
import { createDefaultTurnId } from './turn-runner'

export interface EngineeringAgentSessionSnapshot {
  sessionId: string
  status: EngineeringAgentSessionStatus
  currentTurnId?: string
  abortReason?: string
  turns: EngineeringTurnResult[]
}

export interface EngineeringAgentSessionDeps {
  sessionId: string
  runner: EngineeringTurnRunner
}

export class EngineeringAgentSession {
  private status: EngineeringAgentSessionStatus = 'idle'
  private currentTurnId: string | undefined
  private abortReason: string | undefined
  private readonly turns: EngineeringTurnResult[] = []

  constructor(private readonly deps: EngineeringAgentSessionDeps) {}

  get sessionId(): string {
    return this.deps.sessionId
  }

  get currentStatus(): EngineeringAgentSessionStatus {
    return this.status
  }

  async submit(input: Omit<EngineeringTurnInput, 'sessionId'>): Promise<EngineeringTurnResult> {
    if (this.status === 'running') {
      throw new Error('Engineering agent session is already running')
    }

    const turnId = input.turnId || createDefaultTurnId()
    this.abortReason = undefined
    this.status = 'running'
    this.currentTurnId = turnId

    try {
      const result = await this.deps.runner.run({ ...input, sessionId: this.sessionId, turnId })
      const statusAfterRun = this.getStatus()
      if (statusAfterRun !== 'aborted') {
        this.status = result.status === 'failed' ? 'failed' : 'idle'
      }
      this.currentTurnId = undefined
      const finalStatus = this.getStatus()
      this.turns.push(finalStatus === 'aborted' ? { ...result, status: 'aborted', error: this.abortReason } : result)
      return this.turns[this.turns.length - 1]
    } catch (error) {
      const finalStatus: EngineeringAgentSessionStatus = this.getStatus() === 'aborted' ? 'aborted' : 'failed'
      this.status = finalStatus
      this.currentTurnId = undefined
      const failure: EngineeringTurnResult = {
        sessionId: this.sessionId,
        turnId,
        status: finalStatus,
        error: finalStatus === 'aborted' ? this.abortReason : stringifyError(error),
      }
      this.turns.push(failure)
      return failure
    }
  }

  abort(reason = 'aborted'): void {
    if (this.status !== 'running') return
    this.status = 'aborted'
    this.abortReason = reason
  }

  private getStatus(): EngineeringAgentSessionStatus {
    return this.status
  }

  snapshot(): EngineeringAgentSessionSnapshot {
    return {
      sessionId: this.sessionId,
      status: this.status,
      currentTurnId: this.currentTurnId,
      abortReason: this.abortReason,
      turns: [...this.turns],
    }
  }
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
