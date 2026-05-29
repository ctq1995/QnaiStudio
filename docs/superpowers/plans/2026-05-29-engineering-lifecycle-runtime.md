# Engineering Lifecycle Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight Engineering Lifecycle Runtime that provides PilotDeck-style lifecycle hook extension points for QnaiStudio's self-developed Agent.

**Architecture:** Implement a focused TypeScript runtime module with hook registration, priority-ordered dispatch, and structured hook execution results. Keep it independent from UI, persistence, and `EngineeringExecutionPipeline` behavior in this phase; export it from the engineering package for later TurnRunner/Pipeline integration.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/lifecycle-runtime.ts`: lifecycle event types, hook interfaces, runtime implementation, factory.
- Modify `src/ai-runtime/engineering/index.ts`: export lifecycle runtime.

---

### Task 1: Lifecycle Runtime Module

**Files:**
- Create: `src/ai-runtime/engineering/lifecycle-runtime.ts`

- [ ] **Step 1: Create lifecycle runtime implementation**

Create `src/ai-runtime/engineering/lifecycle-runtime.ts`:

```ts
export type EngineeringLifecycleEventType =
  | 'SessionStart'
  | 'TurnStart'
  | 'UserPromptSubmit'
  | 'ContextBuilt'
  | 'BeforeTool'
  | 'AfterTool'
  | 'BeforeVerify'
  | 'AfterVerify'
  | 'TurnEnd'
  | 'SessionEnd'

export interface EngineeringLifecycleEvent<TPayload = unknown> {
  type: EngineeringLifecycleEventType
  sessionId?: string
  turnId?: string
  taskId?: string
  createdAt: string
  payload?: TPayload
}

export interface EngineeringLifecycleHook {
  id: string
  priority?: number
  handle(event: EngineeringLifecycleEvent): void | Promise<void>
}

export interface EngineeringLifecycleHookResult {
  hookId: string
  success: boolean
  error?: string
  startedAt: string
  completedAt: string
  durationMs: number
}

export interface EngineeringLifecycleDispatchResult {
  event: EngineeringLifecycleEvent
  hookResults: EngineeringLifecycleHookResult[]
  failedHooks: number
}

export interface EngineeringLifecycleRuntimeSnapshot {
  hooks: Array<{ id: string; priority: number }>
}

export class EngineeringLifecycleRuntime {
  private readonly hooks = new Map<string, EngineeringLifecycleHook>()

  registerHook(hook: EngineeringLifecycleHook): void {
    this.hooks.set(hook.id, hook)
  }

  unregisterHook(id: string): boolean {
    return this.hooks.delete(id)
  }

  listHooks(): EngineeringLifecycleRuntimeSnapshot['hooks'] {
    return this.getOrderedHooks().map((hook) => ({ id: hook.id, priority: normalizePriority(hook.priority) }))
  }

  snapshot(): EngineeringLifecycleRuntimeSnapshot {
    return { hooks: this.listHooks() }
  }

  async dispatch(event: Omit<EngineeringLifecycleEvent, 'createdAt'> & { createdAt?: string }): Promise<EngineeringLifecycleDispatchResult> {
    const normalizedEvent: EngineeringLifecycleEvent = {
      ...event,
      createdAt: event.createdAt || new Date().toISOString(),
    }

    const hookResults: EngineeringLifecycleHookResult[] = []
    for (const hook of this.getOrderedHooks()) {
      hookResults.push(await runHook(hook, normalizedEvent))
    }

    return {
      event: normalizedEvent,
      hookResults,
      failedHooks: hookResults.filter((result) => !result.success).length,
    }
  }

  private getOrderedHooks(): EngineeringLifecycleHook[] {
    return [...this.hooks.values()].sort((left, right) => normalizePriority(right.priority) - normalizePriority(left.priority) || left.id.localeCompare(right.id))
  }
}

export function createEngineeringLifecycleRuntime(hooks: EngineeringLifecycleHook[] = []): EngineeringLifecycleRuntime {
  const runtime = new EngineeringLifecycleRuntime()
  for (const hook of hooks) {
    runtime.registerHook(hook)
  }
  return runtime
}

async function runHook(hook: EngineeringLifecycleHook, event: EngineeringLifecycleEvent): Promise<EngineeringLifecycleHookResult> {
  const startedAt = new Date().toISOString()
  const startedMs = Date.now()
  try {
    await hook.handle(event)
    return {
      hookId: hook.id,
      success: true,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
    }
  } catch (error) {
    return {
      hookId: hook.id,
      success: false,
      error: stringifyError(error),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
    }
  }
}

function normalizePriority(priority: number | undefined): number {
  return priority ?? 0
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

---

### Task 2: Export Lifecycle Runtime

**Files:**
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Export lifecycle runtime**

Add this export to `src/ai-runtime/engineering/index.ts`:

```ts
export * from './lifecycle-runtime'
```

- [ ] **Step 2: Run final build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add src/ai-runtime/engineering/lifecycle-runtime.ts src/ai-runtime/engineering/index.ts docs/superpowers/plans/2026-05-29-engineering-lifecycle-runtime.md
git commit -m "feat: add engineering lifecycle runtime"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: lifecycle event types, hook registration, unregister, priority dispatch, sync/async hook support, structured success/failure results, snapshot, export, and build validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: UI integration, transcript persistence, replay, policy blocking, input mutation, and AbortSignal propagation are intentionally out of scope for this phase.
