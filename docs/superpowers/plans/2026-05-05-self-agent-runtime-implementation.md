# Self Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-phase self-developed single-agent runtime for QnAI Studio with structured task state, workspace-limited built-in tools, and transparent UI integration on top of the existing multi-engine runtime.

**Architecture:** Extend the current TypeScript ai-runtime rather than replacing it. Add an agent runtime loop, normalized action parsing, a dedicated tool runtime, and a separate agent task store that feeds existing chat-oriented UI surfaces.

**Tech Stack:** React, TypeScript, Zustand, Tauri bridge services, existing ai-runtime/event bus

---

## File Structure

### Existing files to modify

- `src/ai-runtime/task.ts`
  - Extend the generic task model with agent-specific task kinds or related helpers while preserving current usage.
- `src/ai-runtime/event.ts`
  - Add agent event types, payload shapes, creators, and type guards.
- `src/ai-runtime/index.ts`
  - Export new runtime, event, and tool types.
- `src/services/aiRuntimeService.ts`
  - Add an entry point for agent task submission and runtime bridging.
- `src/stores/index.ts`
  - Export the new agent task store.
- `src/stores/eventChatStore.ts`
  - Map agent state into chat-facing display data without making chat messages the source of truth.
- `src/types/chat.ts`
  - Add chat-facing types for agent timeline cards if they do not already exist elsewhere.
- `src/components/Chat/*`
  - Render agent tool/todo/task states in the existing chat surface.
- `src/components/ToolPanel/*`
  - Show current task details, tool activity, and todos.
- `src/components/StatusBar/*`
  - Show agent runtime status.
- `src/components/Developer/*`
  - Show raw action/debug timeline if needed through existing views.

### New files to create

- `src/types/agent.ts`
  - Source-of-truth types for `AgentTask`, `AgentStep`, `ToolCall`, `TodoItem`, normalized actions.
- `src/types/tool.ts`
  - Shared tool execution interfaces and tool context types.
- `src/ai-runtime/agent-context.ts`
  - Context builder for runtime rounds.
- `src/ai-runtime/agent-output-parser.ts`
  - Parse/normalize model output to agent actions.
- `src/ai-runtime/agent-event-mapper.ts`
  - Convert runtime transitions to AI events.
- `src/ai-runtime/agent-runtime.ts`
  - Single-agent execution loop.
- `src/stores/agentTaskStore.ts`
  - Structured task/step/tool/todo Zustand store.
- `src/tools/types.ts`
  - Built-in tool definitions.
- `src/tools/registry.ts`
  - Built-in tool registry.
- `src/tools/executor.ts`
  - Execute validated tool calls.
- `src/tools/builtins/read.ts`
- `src/tools/builtins/grep.ts`
- `src/tools/builtins/glob.ts`
- `src/tools/builtins/edit.ts`
- `src/tools/builtins/write.ts`
- `src/tools/builtins/bash.ts`
- `src/tools/builtins/todo-write.ts`
- `src/tools/index.ts`
  - Re-export tool runtime.

### Tests to add

This codebase does not show an existing test harness in the currently inspected files. Before adding large runtime code, first confirm whether `npm test`, `vitest`, or another runner exists in `package.json`. If no runner exists, add narrow verification through TypeScript build checks and isolated runtime smoke tests only if already supported by project conventions.

---

### Task 1: Verify available verification commands and task touch points

**Files:**
- Modify: none
- Inspect: `package.json`, `src/services/aiRuntimeService.ts`, `src/stores/index.ts`

- [ ] **Step 1: Read package scripts and runtime integration files**

Read these files before implementation:

- `package.json`
- `src/services/aiRuntimeService.ts`
- `src/stores/index.ts`

Focus on:
- available build/test scripts
- how runtime services are exposed today
- how stores are exported today

- [ ] **Step 2: Record the verification commands to use later**

Choose the real commands from `package.json`, for example one of these shapes:

```bash
npm run build
npm run lint
npm run test
```

If `test` is absent, use the strongest available non-interactive verification command set and document that in implementation notes.

- [ ] **Step 3: Commit the plan checkpoint**

```bash
git add docs/superpowers/specs/2026-05-05-self-agent-design.md docs/superpowers/plans/2026-05-05-self-agent-runtime-implementation.md
git commit -m "docs: add self agent runtime spec and plan"
```

### Task 2: Add source-of-truth agent and tool type models

**Files:**
- Create: `src/types/agent.ts`
- Create: `src/types/tool.ts`
- Modify: `src/ai-runtime/task.ts`
- Modify: `src/ai-runtime/index.ts`
- Modify: `src/stores/index.ts`

- [ ] **Step 1: Write the failing type usage target**

Use these exact interfaces as the first implementation target:

```ts
export type AgentTaskStatus = 'queued' | 'running' | 'waiting_tool' | 'completed' | 'failed' | 'cancelled'
export type AgentStepKind = 'model_response' | 'tool_call' | 'tool_result' | 'todo_update' | 'system'
export type AgentStepStatus = 'pending' | 'running' | 'completed' | 'failed'
export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export interface TodoItem {
  id: string
  taskId: string
  content: string
  status: TodoStatus
}

export interface ToolCallRecord {
  id: string
  taskId: string
  stepId: string
  toolName: string
  args: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: number
  finishedAt?: number
  result?: unknown
  error?: string
}

export interface AgentStep {
  id: string
  taskId: string
  index: number
  kind: AgentStepKind
  status: AgentStepStatus
  content?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  toolResult?: unknown
  startedAt?: number
  finishedAt?: number
  error?: string
}

export interface AgentTaskRecord {
  id: string
  title: string
  userPrompt: string
  status: AgentTaskStatus
  engineId?: string
  sessionId?: string
  createdAt: number
  updatedAt: number
  finalOutput?: string
  error?: string
}
```

- [ ] **Step 2: Add tool runtime shared interfaces**

Use this exact base shape in `src/types/tool.ts`:

```ts
import type { TodoItem } from './agent'

export interface ToolExecutionContext {
  workspacePath: string
  taskId: string
  stepId: string
  signal?: AbortSignal
  applyTodos?: (todos: TodoItem[]) => void
}

export interface ToolExecutionResult {
  success: boolean
  content: string
  data?: unknown
  error?: string
}

export interface AgentTool<Input = unknown, Output = ToolExecutionResult> {
  name: string
  description: string
  validate(input: unknown): Input
  execute(input: Input, context: ToolExecutionContext): Promise<Output>
}
```

- [ ] **Step 3: Extend task model for agent usage**

Add an `agent` task kind in `src/ai-runtime/task.ts`:

```ts
export type AITaskKind = 'chat' | 'refactor' | 'analyze' | 'generate' | 'agent'
```

Do not remove or rename existing kinds.

- [ ] **Step 4: Export the new types from runtime and store barrels**

Add explicit exports from `src/ai-runtime/index.ts` and `src/stores/index.ts` for the new types/store modules once created.

- [ ] **Step 5: Run the verification command and fix type errors from this task**

Run the real build/typecheck command found in Task 1.
Expected: current task changes compile without introducing new type errors in touched files.

- [ ] **Step 6: Commit**

```bash
git add src/types/agent.ts src/types/tool.ts src/ai-runtime/task.ts src/ai-runtime/index.ts src/stores/index.ts
git commit -m "feat: add agent runtime core types"
```

### Task 3: Add agent event types and event creators

**Files:**
- Modify: `src/ai-runtime/event.ts`
- Modify: `src/ai-runtime/index.ts`
- Test: build/typecheck command from Task 1

- [ ] **Step 1: Add failing event API targets**

Implement these event names and payload shapes in `src/ai-runtime/event.ts`:

```ts
export type AgentEventType =
  | 'agent.task.created'
  | 'agent.task.started'
  | 'agent.task.completed'
  | 'agent.task.failed'
  | 'agent.task.cancelled'
  | 'agent.step.created'
  | 'agent.step.updated'
  | 'agent.step.completed'
  | 'agent.step.failed'
  | 'agent.tool.called'
  | 'agent.tool.started'
  | 'agent.tool.completed'
  | 'agent.tool.failed'
  | 'agent.todo.updated'
  | 'agent.model.delta'
  | 'agent.model.message'
  | 'agent.model.done'
```

- [ ] **Step 2: Add a shared agent event payload shape**

Use this exact shape as the common event wrapper:

```ts
export interface AgentRuntimeEvent<T = unknown> {
  type: AgentEventType
  taskId: string
  sessionId?: string
  stepId?: string
  timestamp: number
  payload: T
}
```

- [ ] **Step 3: Add event creator helpers and type guards**

Create focused helpers matching project style, for example:

```ts
export function createAgentRuntimeEvent<T>(
  type: AgentEventType,
  taskId: string,
  payload: T,
  options?: { sessionId?: string; stepId?: string; timestamp?: number }
): AgentRuntimeEvent<T> {
  return {
    type,
    taskId,
    sessionId: options?.sessionId,
    stepId: options?.stepId,
    timestamp: options?.timestamp ?? Date.now(),
    payload,
  }
}
```

Also add a guard:

```ts
export function isAgentRuntimeEvent(event: AIEvent | AgentRuntimeEvent): event is AgentRuntimeEvent {
  return typeof event.type === 'string' && event.type.startsWith('agent.')
}
```

- [ ] **Step 4: Re-export the event helpers**

Update `src/ai-runtime/index.ts` to export the new agent event types, creators, and guards.

- [ ] **Step 5: Run the verification command and confirm compile success**

Expected: no event typing regressions in touched files.

- [ ] **Step 6: Commit**

```bash
git add src/ai-runtime/event.ts src/ai-runtime/index.ts
git commit -m "feat: add agent runtime events"
```

### Task 4: Build the agent task store as the new source of truth

**Files:**
- Create: `src/stores/agentTaskStore.ts`
- Modify: `src/stores/index.ts`
- Test: build/typecheck command from Task 1

- [ ] **Step 1: Create the store state shape**

Use this exact store contract:

```ts
interface AgentTaskState {
  tasks: Record<string, AgentTaskRecord>
  taskOrder: string[]
  stepsByTask: Record<string, AgentStep[]>
  toolCallsByTask: Record<string, ToolCallRecord[]>
  todosByTask: Record<string, TodoItem[]>
  activeTaskId: string | null
  upsertTask: (task: AgentTaskRecord) => void
  setActiveTask: (taskId: string | null) => void
  appendStep: (step: AgentStep) => void
  updateStep: (taskId: string, stepId: string, patch: Partial<AgentStep>) => void
  upsertToolCall: (call: ToolCallRecord) => void
  replaceTodos: (taskId: string, todos: TodoItem[]) => void
  setTaskFinalOutput: (taskId: string, finalOutput: string) => void
  setTaskError: (taskId: string, error: string) => void
  resetAgentState: () => void
}
```

- [ ] **Step 2: Implement append/update helpers without abstractions beyond current need**

Use direct immutable updates. Keep helpers local to the store file. Do not create generic collection utilities.

- [ ] **Step 3: Export the store**

Add the store export in `src/stores/index.ts`.

- [ ] **Step 4: Run the verification command**

Expected: new store compiles and exports cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/stores/agentTaskStore.ts src/stores/index.ts
git commit -m "feat: add agent task store"
```

### Task 5: Build the tool runtime and workspace-limited built-in tools

**Files:**
- Create: `src/tools/types.ts`
- Create: `src/tools/registry.ts`
- Create: `src/tools/executor.ts`
- Create: `src/tools/index.ts`
- Create: `src/tools/builtins/read.ts`
- Create: `src/tools/builtins/grep.ts`
- Create: `src/tools/builtins/glob.ts`
- Create: `src/tools/builtins/edit.ts`
- Create: `src/tools/builtins/write.ts`
- Create: `src/tools/builtins/bash.ts`
- Create: `src/tools/builtins/todo-write.ts`
- Modify: `src/services/tauri.ts` only if a safe wrapper is needed and already consistent with existing patterns
- Test: build/typecheck command from Task 1

- [ ] **Step 1: Define the built-in tool input shapes**

Use these exact input contracts:

```ts
export interface ReadToolInput { file_path: string; start_line?: number; limit?: number }
export interface GrepToolInput { pattern: string; path?: string; glob?: string; output_mode?: 'files_with_matches' | 'content' | 'count' }
export interface GlobToolInput { pattern: string; path?: string; limit?: number }
export interface EditToolInput { file_path: string; old_string: string; new_string: string; replace_all?: boolean }
export interface WriteToolInput { file_path: string; content: string }
export interface BashToolInput { command: string; description?: string; timeout_ms?: number }
export interface TodoWriteToolInput { todos: TodoItem[] }
```

- [ ] **Step 2: Add workspace boundary enforcement helper in tool runtime**

Implement a shared local helper used by file tools:

```ts
function ensureWorkspacePath(workspacePath: string, targetPath: string): string {
  const resolvedWorkspace = normalizePath(workspacePath)
  const resolvedTarget = normalizePath(targetPath)
  if (!resolvedTarget.startsWith(resolvedWorkspace)) {
    throw new Error('Path must stay within the workspace')
  }
  return resolvedTarget
}
```

Keep it local to the tool runtime or a single tool support file if needed. Do not create a broad utils package.

- [ ] **Step 3: Implement registry and executor**

Use this exact execution flow:

```ts
export class ToolRegistry {
  private tools = new Map<string, AgentTool>()

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  list(): AgentTool[] {
    return Array.from(this.tools.values())
  }
}
```

```ts
export async function executeToolCall(
  registry: ToolRegistry,
  toolName: string,
  input: unknown,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const tool = registry.get(toolName)
  if (!tool) {
    return { success: false, content: '', error: `Unknown tool: ${toolName}` }
  }

  const validated = tool.validate(input)
  return tool.execute(validated, context)
}
```

- [ ] **Step 4: Implement minimal built-in tools**

Each built-in tool should:
- validate required fields inline
- stay within workspace boundaries
- return `ToolExecutionResult`
- avoid speculative extra features

For `TodoWrite`, use this exact implementation pattern:

```ts
export const todoWriteTool: AgentTool<TodoWriteToolInput> = {
  name: 'TodoWrite',
  description: 'Update structured todo items for the current task',
  validate(input) {
    const value = input as TodoWriteToolInput
    if (!value || !Array.isArray(value.todos)) {
      throw new Error('todos must be an array')
    }
    return value
  },
  async execute(input, context) {
    context.applyTodos?.(input.todos)
    return {
      success: true,
      content: `Updated ${input.todos.length} todo items`,
      data: input.todos,
    }
  },
}
```

- [ ] **Step 5: Export a default built-in registry**

Create an index export that registers all built-ins once and exposes the ready-to-use registry.

- [ ] **Step 6: Run the verification command**

Expected: tool runtime compiles and no unsafe cross-workspace path access remains in touched code.

- [ ] **Step 7: Commit**

```bash
git add src/tools src/services/tauri.ts
git commit -m "feat: add agent built-in tool runtime"
```

### Task 6: Build the normalized action parser and context builder

**Files:**
- Create: `src/ai-runtime/agent-context.ts`
- Create: `src/ai-runtime/agent-output-parser.ts`
- Modify: `src/ai-runtime/index.ts`
- Test: build/typecheck command from Task 1

- [ ] **Step 1: Define normalized action types in `src/types/agent.ts` if not already added**

Use these exact action shapes:

```ts
export type AgentAction = AssistantTextAction | ToolCallAction | TodoUpdateAction | FinalAction

export interface AssistantTextAction {
  type: 'assistant_text'
  content: string
}

export interface ToolCallAction {
  type: 'tool_call'
  tool: string
  args: Record<string, unknown>
}

export interface TodoUpdateAction {
  type: 'todo_update'
  todos: TodoItem[]
}

export interface FinalAction {
  type: 'final'
  content: string
}
```

- [ ] **Step 2: Implement the context builder**

Use this exact return shape from `buildAgentContext`:

```ts
export interface AgentContextSnapshot {
  prompt: string
  task: AgentTaskRecord
  steps: AgentStep[]
  toolCalls: ToolCallRecord[]
  todos: TodoItem[]
}
```

The function should only gather the current task snapshot. Do not add prompt templating logic here.

- [ ] **Step 3: Implement a minimal parser for normalized actions**

Support two paths:
- already-structured action arrays
- JSON text that can be parsed into one action or an array of actions

Use this exact fallback behavior:

```ts
export function parseAgentOutput(output: unknown): AgentAction[] {
  if (Array.isArray(output)) return output as AgentAction[]
  if (typeof output === 'object' && output && 'type' in output) return [output as AgentAction]
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output)
      if (Array.isArray(parsed)) return parsed as AgentAction[]
      if (parsed && typeof parsed === 'object' && 'type' in parsed) return [parsed as AgentAction]
    } catch {
      return [{ type: 'assistant_text', content: output }]
    }
  }
  return []
}
```

- [ ] **Step 4: Export parser and context builder**

Update `src/ai-runtime/index.ts` accordingly.

- [ ] **Step 5: Run the verification command**

Expected: parser and context builder compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/ai-runtime/agent-context.ts src/ai-runtime/agent-output-parser.ts src/ai-runtime/index.ts src/types/agent.ts
git commit -m "feat: add agent action parser and context builder"
```

### Task 7: Build the single-agent runtime loop and event mapper

**Files:**
- Create: `src/ai-runtime/agent-event-mapper.ts`
- Create: `src/ai-runtime/agent-runtime.ts`
- Modify: `src/ai-runtime/index.ts`
- Modify: `src/services/aiRuntimeService.ts`
- Test: build/typecheck command from Task 1

- [ ] **Step 1: Add the runtime constructor contract**

Use this exact top-level contract:

```ts
interface AgentRuntimeDependencies {
  eventBus: { emit: (type: string, event: unknown) => void }
  executeModel: (input: { task: AgentTaskRecord; context: AgentContextSnapshot }) => Promise<unknown>
  executeTool: (toolName: string, args: unknown, context: ToolExecutionContext) => Promise<ToolExecutionResult>
  store: {
    upsertTask: (task: AgentTaskRecord) => void
    appendStep: (step: AgentStep) => void
    updateStep: (taskId: string, stepId: string, patch: Partial<AgentStep>) => void
    upsertToolCall: (call: ToolCallRecord) => void
    replaceTodos: (taskId: string, todos: TodoItem[]) => void
    setTaskFinalOutput: (taskId: string, finalOutput: string) => void
    setTaskError: (taskId: string, error: string) => void
  }
  workspacePath: string
}
```

- [ ] **Step 2: Implement the runtime loop**

Use this exact loop skeleton:

```ts
for (let round = 0; round < 12; round += 1) {
  const context = buildAgentContext(taskId)
  const rawOutput = await deps.executeModel({ task, context })
  const actions = parseAgentOutput(rawOutput)

  if (actions.length === 0) {
    throw new Error('Model returned no actionable output')
  }

  for (const action of actions) {
    // assistant_text => append step
    // todo_update => replace todos
    // tool_call => execute tool and append step + tool record + result step
    // final => set final output and return
  }
}

throw new Error('Agent exceeded maximum rounds')
```

- [ ] **Step 3: Implement event mapping for task/step/tool/todo transitions**

Each state change should emit one agent runtime event with a payload that mirrors the changed record. Do not emit synthetic chat text here.

- [ ] **Step 4: Add a service entry point in `aiRuntimeService.ts`**

Add a method shaped like:

```ts
async runAgentTask(input: {
  prompt: string
  engineId?: string
  workspacePath: string
}): Promise<string>
```

Return the created `taskId`.

The method should:
- create an `agent` AITask or `AgentTaskRecord`
- start the runtime
- leave rendering concerns to stores/UI

- [ ] **Step 5: Run the verification command**

Expected: runtime and service entry compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/ai-runtime/agent-event-mapper.ts src/ai-runtime/agent-runtime.ts src/ai-runtime/index.ts src/services/aiRuntimeService.ts
git commit -m "feat: add single agent runtime loop"
```

### Task 8: Bridge agent events into the structured store and chat facade

**Files:**
- Modify: `src/stores/agentTaskStore.ts`
- Modify: `src/stores/eventChatStore.ts`
- Modify: `src/types/chat.ts`
- Test: build/typecheck command from Task 1

- [ ] **Step 1: Add a compact chat-facing timeline type**

If `src/types/chat.ts` needs a dedicated shape, add this exact interface:

```ts
export interface AgentTimelineItem {
  id: string
  taskId: string
  kind: 'assistant_text' | 'tool_call' | 'tool_result' | 'todo_update' | 'final' | 'error'
  title: string
  content?: string
  toolName?: string
  status?: string
  timestamp: number
}
```

- [ ] **Step 2: Add a selector that maps agent source-of-truth state to a timeline**

Implement mapping in `eventChatStore.ts` or the smallest existing chat sub-store entry point already responsible for facade shaping. The mapping should read from `agentTaskStore` and produce timeline items; it must not become the source of truth.

- [ ] **Step 3: Preserve existing chat APIs while exposing active agent task data**

Add non-breaking fields to the facade only, for example:

```ts
activeAgentTaskId: string | null
agentTimeline: AgentTimelineItem[]
agentTodos: TodoItem[]
```

Do not remove existing fields.

- [ ] **Step 4: Run the verification command**

Expected: old chat facade still compiles and new fields are available.

- [ ] **Step 5: Commit**

```bash
git add src/stores/agentTaskStore.ts src/stores/eventChatStore.ts src/types/chat.ts
git commit -m "feat: bridge agent state into chat facade"
```

### Task 9: Render agent runtime state in Chat, ToolPanel, and StatusBar

**Files:**
- Modify: `src/components/Chat/*`
- Modify: `src/components/ToolPanel/*`
- Modify: `src/components/StatusBar/*`
- Modify: `src/components/Developer/*` only if already used for runtime debug rendering
- Test: build/typecheck command from Task 1

- [ ] **Step 1: Render agent timeline cards in Chat**

Add rendering branches for:
- assistant text
- tool call
- tool result
- todo update
- final output
- error

The minimal card titles should be exactly:

```ts
'Tool Call'
'Tool Result'
'Todo Update'
'Final Result'
'Error'
```

- [ ] **Step 2: Show active task details in ToolPanel**

Render:
- active task status
- current step count
- latest tool call
- todo list
- latest error if present

- [ ] **Step 3: Show runtime summary in StatusBar**

Render:
- active agent task status
- active engine id if available
- total step count

Keep the UI additive and non-destructive to current features.

- [ ] **Step 4: Optionally surface raw actions/events in Developer panel**

Only add this if there is already a suitable debug area. Do not create a brand-new debug subsystem.

- [ ] **Step 5: Run the verification command**

Expected: UI compiles without breaking existing chat layout.

- [ ] **Step 6: Commit**

```bash
git add src/components/Chat src/components/ToolPanel src/components/StatusBar src/components/Developer
 git commit -m "feat: render agent runtime in existing UI"
```

### Task 10: Add failure handling, cancellation support, and final verification

**Files:**
- Modify: `src/ai-runtime/agent-runtime.ts`
- Modify: `src/stores/agentTaskStore.ts`
- Modify: `src/services/aiRuntimeService.ts`
- Test: all verification commands from Task 1

- [ ] **Step 1: Add structured runtime failure handling**

Use this exact failure path inside runtime:

```ts
catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  store.setTaskError(task.id, message)
  emit agent.task.failed
  throw error
}
```

- [ ] **Step 2: Add cancellation plumbing**

Add a store-safe cancel state transition to `cancelled`, and ensure any active runtime respects an abort signal if one already exists in surrounding infrastructure.

- [ ] **Step 3: Run all verification commands**

Run the real commands found in Task 1, for example:

```bash
npm run build
npm run lint
npm run test
```

Record actual outputs used for final summary.

- [ ] **Step 4: Manually smoke-check the runtime path**

Verify this exact scenario through the app if the project already supports local manual testing:
- submit one simple agent task
- observe at least one assistant step
- observe one tool call/result
- observe final output or structured failure

If a dev server command exists, use the existing project command only.

- [ ] **Step 5: Commit**

```bash
git add src/ai-runtime/agent-runtime.ts src/stores/agentTaskStore.ts src/services/aiRuntimeService.ts
git commit -m "feat: finalize self agent runtime flow"
```

---

## Self-Review

### Spec coverage

- Structured task/step/tool/todo data model: covered by Tasks 2, 4.
- Agent event namespace: covered by Task 3.
- Runtime-owned loop: covered by Tasks 6, 7, 10.
- Built-in tool runtime: covered by Task 5.
- UI integration in Chat/ToolPanel/StatusBar/Developer: covered by Tasks 8, 9.
- Failure handling and completion flow: covered by Task 10.

### Placeholder scan

- No `TBD`/`TODO` placeholders remain.
- Each code-shaping task includes concrete interfaces or code skeletons.
- Verification and commit steps are explicit.

### Type consistency

- `AgentTaskRecord`, `AgentStep`, `ToolCallRecord`, `TodoItem`, `AgentAction`, `ToolExecutionResult` are used consistently across tasks.
- `agent` was added as the task kind consistently.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-05-self-agent-runtime-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**