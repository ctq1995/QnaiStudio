import { createEngineeringLifecycleRuntime, type EngineeringLifecycleRuntime } from './lifecycle-runtime'
import { createEngineeringTranscriptRecorder, type EngineeringTranscriptRecorder, type EngineeringTranscriptSnapshot } from './transcript-recorder'
import { EngineeringTurnRunner, type EngineeringTurnInput, type EngineeringTurnResult, type EngineeringTurnRunnerDeps } from './turn-runner'

export interface EngineeringRuntimeDeps {
  sessionId: string
  turnRunner: EngineeringTurnRunner
  lifecycleRuntime?: EngineeringLifecycleRuntime
  transcriptRecorder?: EngineeringTranscriptRecorder
  pendingTranscriptWrites?: Promise<void>[]
  transcriptRecordErrors?: string[]
}

export interface EngineeringRuntimeFromTurnRunnerDepsInput {
  sessionId: string
  turnRunnerDeps: EngineeringTurnRunnerDeps
  lifecycleRuntime?: EngineeringLifecycleRuntime
  transcriptRecorder?: EngineeringTranscriptRecorder
}

export interface EngineeringRuntimeTurnResult {
  turn: EngineeringTurnResult
  transcript: EngineeringTranscriptSnapshot
}

export interface EngineeringRuntimeSnapshot {
  sessionId: string
  lifecycle: ReturnType<EngineeringLifecycleRuntime['snapshot']>
}

export class EngineeringRuntime {
  private readonly sessionId: string
  private readonly turnRunner: EngineeringTurnRunner
  private readonly lifecycleRuntime: EngineeringLifecycleRuntime
  private readonly transcriptRecorder: EngineeringTranscriptRecorder
  private readonly pendingTranscriptWrites: Promise<void>[]
  private readonly transcriptRecordErrors: string[]

  private constructor(deps: EngineeringRuntimeDeps) {
    this.sessionId = deps.sessionId
    this.lifecycleRuntime = deps.lifecycleRuntime || createEngineeringLifecycleRuntime()
    this.transcriptRecorder = deps.transcriptRecorder || createEngineeringTranscriptRecorder()
    this.turnRunner = deps.turnRunner
    this.pendingTranscriptWrites = deps.pendingTranscriptWrites || []
    this.transcriptRecordErrors = deps.transcriptRecordErrors || []
  }

  static fromTurnRunnerDeps(input: EngineeringRuntimeFromTurnRunnerDepsInput): EngineeringRuntime {
    const transcriptRecorder = input.transcriptRecorder || createEngineeringTranscriptRecorder()
    const pendingTranscriptWrites: Promise<void>[] = []
    const transcriptRecordErrors: string[] = []
    const enqueueTranscriptWrite = (write: Promise<void>) => {
      const tracked = write.catch((error) => {
        transcriptRecordErrors.push(stringifyError(error))
      })
      pendingTranscriptWrites.push(tracked)
    }
    const turnRunner = new EngineeringTurnRunner({
      ...input.turnRunnerDeps,
      onTurnEvent: (event) => {
        enqueueTranscriptWrite(transcriptRecorder.recordTurnEvent(event).then(() => undefined))
        input.turnRunnerDeps.onTurnEvent?.(event)
      },
    })

    return new EngineeringRuntime({
      sessionId: input.sessionId,
      turnRunner,
      lifecycleRuntime: input.lifecycleRuntime,
      transcriptRecorder,
      pendingTranscriptWrites,
      transcriptRecordErrors,
    })
  }

  async runTurn(input: Omit<EngineeringTurnInput, 'sessionId'> & { sessionId?: string }): Promise<EngineeringRuntimeTurnResult> {
    const sessionId = input.sessionId || this.sessionId
    const turnId = input.turnId || createRuntimeTurnId()
    let turn: EngineeringTurnResult | undefined
    let turnEnded = false
    let turnStarted = false
    let sessionStarted = false

    try {
      const sessionStart = await this.dispatchAndRecord({ type: 'SessionStart', sessionId })
      sessionStarted = true

      if (sessionStart.blocked) {
        turn = createBlockedTurnResult(sessionId, turnId, sessionStart.blockReason || 'Session blocked by lifecycle hook')
      } else {
        const turnStart = await this.dispatchAndRecord({ type: 'TurnStart', sessionId, turnId })
        if (turnStart.blocked) {
          turn = createBlockedTurnResult(sessionId, turnId, turnStart.blockReason || 'Turn blocked by lifecycle hook')
        } else {
          turnStarted = true
          const prompt = await this.dispatchAndRecord({ type: 'UserPromptSubmit', sessionId, turnId, taskId: input.taskId || turnId, payload: { userRequest: input.userRequest } })
          if (prompt.blocked) {
            turn = createBlockedTurnResult(sessionId, turnId, prompt.blockReason || 'Prompt blocked by lifecycle hook')
          } else {
            turn = await this.turnRunner.run({ ...input, sessionId, turnId, taskId: input.taskId || turnId })
          }
        }
      }
    } catch (error) {
      turn = createBlockedTurnResult(sessionId, turnId, stringifyError(error))
    }

    if (!turn) {
      turn = createBlockedTurnResult(sessionId, turnId, 'Turn did not produce a result')
    }

    if (turnStarted && !turnEnded) {
      await this.dispatchAndRecord({ type: 'TurnEnd', sessionId, turnId, payload: { success: turn.status === 'idle', error: turn.error } })
      turnEnded = true
    }

    if (sessionStarted) {
      await this.dispatchAndRecord({ type: 'SessionEnd', sessionId })
    }

    return { turn, transcript: await this.createTranscriptSnapshot() }
  }

  async recordBridgeEvent(input: Parameters<EngineeringTranscriptRecorder['record']>[0]): Promise<void> {
    await this.safeRecord(() => this.transcriptRecorder.record(input).then(() => undefined))
  }

  snapshot(): EngineeringRuntimeSnapshot {
    return {
      sessionId: this.sessionId,
      lifecycle: this.lifecycleRuntime.snapshot(),
    }
  }

  private async dispatchAndRecord(input: Parameters<EngineeringLifecycleRuntime['dispatch']>[0]) {
    const result = await this.lifecycleRuntime.dispatch(input)
    await this.safeRecord(() => this.transcriptRecorder.recordLifecycleEvent(result.event).then(() => undefined))
    return result
  }

  private async createTranscriptSnapshot(): Promise<EngineeringTranscriptSnapshot> {
    await this.flushTranscriptWrites()
    return this.transcriptRecorder.snapshot()
  }

  private async safeRecord(write: () => Promise<void>): Promise<void> {
    try {
      await write()
    } catch (error) {
      this.transcriptRecordErrors.push(stringifyError(error))
    }
  }

  private async flushTranscriptWrites(): Promise<void> {
    while (this.pendingTranscriptWrites.length > 0) {
      const pending = this.pendingTranscriptWrites.splice(0)
      await Promise.all(pending)
    }
  }
}

export function createEngineeringRuntime(input: EngineeringRuntimeFromTurnRunnerDepsInput): EngineeringRuntime {
  return EngineeringRuntime.fromTurnRunnerDeps(input)
}

function createBlockedTurnResult(sessionId: string, turnId: string, error: string): EngineeringTurnResult {
  return {
    sessionId,
    turnId,
    status: 'failed',
    error,
  }
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function createRuntimeTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
