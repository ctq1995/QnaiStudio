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

interface EngineeringLifecycleEventBase<TType extends EngineeringLifecycleEventType> {
  type: TType
  sessionId?: string
  turnId?: string
  taskId?: string
  createdAt: string
}

export interface EngineeringUserPromptSubmitPayload {
  userRequest: string
}

export interface EngineeringContextBuiltPayload {
  candidateFileCount: number
}

export interface EngineeringBeforeToolPayload {
  toolCallId?: string
  toolName: string
}

export interface EngineeringAfterToolPayload {
  toolCallId?: string
  toolName: string
  success: boolean
  error?: string
}

export interface EngineeringBeforeVerifyPayload {
  commandCount: number
}

export interface EngineeringAfterVerifyPayload {
  resultCount: number
  success: boolean
}

export interface EngineeringTurnEndPayload {
  success: boolean
  error?: string
}

export type EngineeringLifecycleEvent =
  | (EngineeringLifecycleEventBase<'SessionStart'> & { sessionId: string })
  | (EngineeringLifecycleEventBase<'TurnStart'> & { sessionId: string; turnId: string })
  | (EngineeringLifecycleEventBase<'UserPromptSubmit'> & { payload: EngineeringUserPromptSubmitPayload })
  | (EngineeringLifecycleEventBase<'ContextBuilt'> & { payload: EngineeringContextBuiltPayload })
  | (EngineeringLifecycleEventBase<'BeforeTool'> & { payload: EngineeringBeforeToolPayload })
  | (EngineeringLifecycleEventBase<'AfterTool'> & { payload: EngineeringAfterToolPayload })
  | (EngineeringLifecycleEventBase<'BeforeVerify'> & { payload: EngineeringBeforeVerifyPayload })
  | (EngineeringLifecycleEventBase<'AfterVerify'> & { payload: EngineeringAfterVerifyPayload })
  | (EngineeringLifecycleEventBase<'TurnEnd'> & { sessionId: string; turnId: string; payload: EngineeringTurnEndPayload })
  | (EngineeringLifecycleEventBase<'SessionEnd'> & { sessionId: string })

export type EngineeringLifecycleDispatchInput = EngineeringLifecycleEvent extends infer TEvent
  ? TEvent extends EngineeringLifecycleEvent
    ? Omit<TEvent, 'createdAt'> & { createdAt?: string }
    : never
  : never

export type EngineeringLifecycleHookDecision =
  | void
  | { type: 'continue' }
  | { type: 'block'; reason: string }

export interface EngineeringLifecycleHook {
  id: string
  priority?: number
  handle(event: EngineeringLifecycleEvent): EngineeringLifecycleHookDecision | Promise<EngineeringLifecycleHookDecision>
}

export interface EngineeringLifecycleHookResult {
  hookId: string
  success: boolean
  decision: 'continue' | 'block'
  blockReason?: string
  error?: string
  startedAt: string
  completedAt: string
  durationMs: number
}

export interface EngineeringLifecycleDispatchResult {
  event: EngineeringLifecycleEvent
  hookResults: EngineeringLifecycleHookResult[]
  failedHooks: number
  blocked: boolean
  blockedByHookId?: string
  blockReason?: string
}

export interface EngineeringLifecycleRuntimeSnapshot {
  hooks: Array<{ id: string; priority: number }>
}

interface RegisteredEngineeringLifecycleHook {
  hook: EngineeringLifecycleHook
  order: number
}

export class EngineeringLifecycleRuntime {
  private nextOrder = 0
  private readonly hooks = new Map<string, RegisteredEngineeringLifecycleHook>()

  registerHook(hook: EngineeringLifecycleHook): void {
    if (this.hooks.has(hook.id)) {
      throw new Error(`Engineering lifecycle hook already registered: ${hook.id}`)
    }
    this.hooks.set(hook.id, { hook, order: this.nextOrder })
    this.nextOrder += 1
  }

  replaceHook(hook: EngineeringLifecycleHook): void {
    const existing = this.hooks.get(hook.id)
    this.hooks.set(hook.id, { hook, order: existing?.order ?? this.nextOrder })
    if (!existing) {
      this.nextOrder += 1
    }
  }

  unregisterHook(id: string): boolean {
    return this.hooks.delete(id)
  }

  listHooks(): EngineeringLifecycleRuntimeSnapshot['hooks'] {
    return this.getOrderedHooks().map(({ hook }) => ({ id: hook.id, priority: normalizePriority(hook.priority) }))
  }

  snapshot(): EngineeringLifecycleRuntimeSnapshot {
    return { hooks: this.listHooks() }
  }

  async dispatch(event: EngineeringLifecycleDispatchInput): Promise<EngineeringLifecycleDispatchResult> {
    const normalizedEvent = {
      ...event,
      createdAt: event.createdAt || new Date().toISOString(),
    } as EngineeringLifecycleEvent

    const hookResults: EngineeringLifecycleHookResult[] = []
    for (const { hook } of this.getOrderedHooks()) {
      const result = await runHook(hook, normalizedEvent)
      hookResults.push(result)
      if (result.decision === 'block') {
        return {
          event: normalizedEvent,
          hookResults,
          failedHooks: hookResults.filter((result) => !result.success).length,
          blocked: true,
          blockedByHookId: result.hookId,
          blockReason: result.blockReason,
        }
      }
    }

    return {
      event: normalizedEvent,
      hookResults,
      failedHooks: hookResults.filter((result) => !result.success).length,
      blocked: false,
    }
  }

  private getOrderedHooks(): RegisteredEngineeringLifecycleHook[] {
    return [...this.hooks.values()].sort((left, right) => normalizePriority(right.hook.priority) - normalizePriority(left.hook.priority) || left.order - right.order)
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
    const decision = normalizeHookDecision(await hook.handle(event))
    return {
      hookId: hook.id,
      success: true,
      decision: decision.type,
      blockReason: decision.type === 'block' ? decision.reason : undefined,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
    }
  } catch (error) {
    return {
      hookId: hook.id,
      success: false,
      decision: 'continue',
      error: stringifyError(error),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
    }
  }
}

function normalizeHookDecision(decision: EngineeringLifecycleHookDecision): { type: 'continue' } | { type: 'block'; reason: string } {
  if (!decision || decision.type === 'continue') return { type: 'continue' }
  return decision
}

function normalizePriority(priority: number | undefined): number {
  return priority ?? 0
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
