# Engineering Turn Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight Engineering Agent Session and Turn Runner skeleton that wraps the existing engineering execution pipeline with session/turn lifecycle state.

**Architecture:** Keep the existing `EngineeringExecutionPipeline` unchanged and introduce two focused TypeScript modules. `EngineeringTurnRunner` converts an `EngineeringTurnInput` into an `EngineeringRunInput`, calls the pipeline, and emits turn events; `EngineeringAgentSession` owns status, current turn, abort state, completed turns, and snapshots.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/turn-runner.ts`: turn input/result types, event types, runner wrapper around `EngineeringExecutionPipeline`.
- Create `src/ai-runtime/engineering/agent-session.ts`: session state machine around `EngineeringTurnRunner`.
- Modify `src/ai-runtime/engineering/index.ts`: export new modules.

---

### Task 1: Turn Runner Module

**Files:**
- Create: `src/ai-runtime/engineering/turn-runner.ts`

- [ ] **Step 1: Create turn runner module**

Create `src/ai-runtime/engineering/turn-runner.ts`:

```ts
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
  summary: EngineeringRunSummary
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
    return new EngineeringTurnRunner({
      ...options,
      pipeline: new EngineeringExecutionPipeline(deps),
    })
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
      this.emit({ type: 'turn_completed', sessionId: input.sessionId, turnId, success: summary.success })
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

export function createDefaultTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

- [ ] **Step 2: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 2: Agent Session Module

**Files:**
- Create: `src/ai-runtime/engineering/agent-session.ts`

- [ ] **Step 1: Create agent session module**

Create `src/ai-runtime/engineering/agent-session.ts`:

```ts
import type { EngineeringTurnInput, EngineeringTurnResult, EngineeringTurnRunner, EngineeringAgentSessionStatus } from './turn-runner'

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

    this.abortReason = undefined
    this.status = 'running'
    this.currentTurnId = input.turnId

    try {
      const result = await this.deps.runner.run({ ...input, sessionId: this.sessionId })
      if (this.status !== 'aborted') {
        this.status = result.status === 'failed' ? 'failed' : 'idle'
      }
      this.currentTurnId = undefined
      this.turns.push(this.status === 'aborted' ? { ...result, status: 'aborted', error: this.abortReason } : result)
      return this.turns[this.turns.length - 1]
    } catch (error) {
      this.status = this.status === 'aborted' ? 'aborted' : 'failed'
      this.currentTurnId = undefined
      throw error
    }
  }

  abort(reason = 'aborted'): void {
    if (this.status !== 'running') return
    this.status = 'aborted'
    this.abortReason = reason
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
```

- [ ] **Step 2: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Exports and Final Validation

**Files:**
- Modify: `src/ai-runtime/engineering/index.ts`
- Validate: `docs/superpowers/plans/2026-05-29-engineering-turn-runner.md`

- [ ] **Step 1: Export new modules**

In `src/ai-runtime/engineering/index.ts`, add:

```ts
export * from './turn-runner'
export * from './agent-session'
```

- [ ] **Step 2: Run final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-29-engineering-turn-runner.md
git commit -m "feat: add engineering turn runner"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: session status, turn input/result, runner wrapper, session snapshot, mark-aborted semantics, exports, build validation, and commit are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: transcript, replay, lifecycle hooks, and real AbortSignal propagation are intentionally left for later phases.
