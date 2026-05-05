# Self Agent Runtime Design Spec

## Overview

Build a first-phase self-developed single-agent runtime for QnAI Studio by extending the existing multi-engine architecture rather than replacing it. The first release focuses on a TypeScript-led agent loop, structured task/step/tool/todo state, and a minimal built-in toolset that can execute transparent coding tasks inside the workspace.

## Goals

- Add a real agent execution loop on top of the current engine/runtime stack.
- Preserve the existing multi-engine adapter model for Claude Code, Codex CLI, Gemini CLI, and IFlow.
- Introduce structured task state instead of relying on plain chat messages as the source of truth.
- Support a minimal built-in toolset: Read, Grep, Glob, Edit, Write, Bash, TodoWrite.
- Expose the full execution process in the existing Chat, ToolPanel, StatusBar, and Developer UI areas.

## Non-Goals

- Multi-agent collaboration.
- Browser automation or broad desktop automation.
- Full BitFun protocol compatibility in phase one.
- Cloud orchestration or remote workers.
- Long-term memory or vector knowledge base.
- Advanced permission center.

## Architecture

### Incremental Extension Strategy

The self-developed agent runtime should be implemented as an incremental layer over the current runtime instead of a parallel replacement. Existing engine registration, event bus, session handling, and model invocation paths remain in place. The new layer becomes the decision-making controller that drives task execution.

### Execution Ownership

Phase one is TypeScript-led:

- TypeScript owns task lifecycle, agent loop, context assembly, tool dispatch, event emission, and UI-facing state.
- Tauri/Rust remains the capability bridge for safe command execution and file-system backed operations.

This matches the current codebase shape and avoids duplicating runtime logic across frontend and backend.

## Core Modules

### Existing modules to retain

- `src/core/engine-bootstrap.ts`
- `src/engines/index.ts`
- `src/services/aiRuntimeService.ts`
- `src/ai-runtime/event.ts`
- `src/ai-runtime/event-bus.ts`
- `src/ai-runtime/task.ts`
- `src/ai-runtime/task-manager.ts`
- `src/ai-runtime/session.ts`

### New or expanded runtime modules

Recommended additions under `src/ai-runtime/`:

- `agent-runtime.ts`
  - Drives a single task execution loop.
- `agent-context.ts`
  - Builds model context from task state, prior steps, tool outputs, and todos.
- `agent-output-parser.ts`
  - Normalizes model responses into runtime actions.
- `agent-event-mapper.ts`
  - Converts runtime state transitions into event bus events.
- `agent-task.ts`
  - Defines task-level state transitions if existing `task.ts` cannot cleanly absorb them.

### New tool runtime modules

Recommended additions under `src/tools/`:

- `types.ts`
- `registry.ts`
- `executor.ts`
- `builtins/read.ts`
- `builtins/grep.ts`
- `builtins/glob.ts`
- `builtins/edit.ts`
- `builtins/write.ts`
- `builtins/bash.ts`
- `builtins/todo-write.ts`

### State modules

Recommended additions under `src/stores/`:

- `agentTaskStore.ts`
  - Source of truth for tasks, steps, tool calls, and todo items.

The existing `eventChatStore.ts` remains the chat-oriented view layer and should map structured agent state into display timelines.

## Data Model

### AgentTask

Represents a full agent execution session.

Suggested fields:

- `id`
- `title`
- `userPrompt`
- `status`: `queued | running | waiting_tool | completed | failed | cancelled`
- `engineId`
- `sessionId`
- `createdAt`
- `updatedAt`
- `finalOutput`
- `error`

### AgentStep

Represents a single execution step or round.

Suggested fields:

- `id`
- `taskId`
- `index`
- `kind`: `model_response | tool_call | tool_result | todo_update | system`
- `status`: `pending | running | completed | failed`
- `content`
- `toolName`
- `toolArgs`
- `toolResult`
- `startedAt`
- `finishedAt`

### ToolCall

Represents one structured tool invocation.

Suggested fields:

- `id`
- `taskId`
- `stepId`
- `toolName`
- `args`
- `status`
- `startedAt`
- `finishedAt`
- `result`
- `error`

### TodoItem

Suggested fields:

- `id`
- `taskId`
- `content`
- `status`: `pending | in_progress | completed`

## Event Model

The event system should be extended with an agent namespace instead of replacing existing AI events.

### Task lifecycle events

- `agent.task.created`
- `agent.task.started`
- `agent.task.completed`
- `agent.task.failed`
- `agent.task.cancelled`

### Step events

- `agent.step.created`
- `agent.step.updated`
- `agent.step.completed`
- `agent.step.failed`

### Tool events

- `agent.tool.called`
- `agent.tool.started`
- `agent.tool.completed`
- `agent.tool.failed`

### Todo events

- `agent.todo.updated`

### Model events

- `agent.model.delta`
- `agent.model.message`
- `agent.model.done`

## Runtime Flow

The runtime loop should remain explicit and fully observable.

1. User submits a task.
2. Runtime creates `AgentTask`.
3. Runtime assembles context from prompt, prior steps, tool results, and todos.
4. Runtime invokes the selected model engine.
5. Model output is parsed into normalized actions.
6. Todo updates are applied immediately.
7. Tool calls are dispatched through the tool runtime.
8. Tool results are appended back into task state.
9. Runtime continues the next round until final output or failure.
10. UI is updated from structured events and store state throughout the process.

The runtime, not the model, must own the execution loop.

## Model Output Contract

Phase one should adopt a minimal normalized action protocol.

### Assistant text

```json
{
  "type": "assistant_text",
  "content": "I will inspect the relevant files first."
}
```

### Tool call

```json
{
  "type": "tool_call",
  "tool": "Read",
  "args": {
    "file_path": "src/App.tsx"
  }
}
```

### Todo update

```json
{
  "type": "todo_update",
  "todos": [
    {
      "id": "read-entry",
      "content": "Inspect the app entry file",
      "status": "completed"
    }
  ]
}
```

### Final output

```json
{
  "type": "final",
  "content": "The requested change has been completed."
}
```

Different engines may emit different raw formats, but all outputs must be normalized before entering the agent runtime.

## Tool Runtime Design

Each built-in tool should follow a shared interface.

```ts
interface AgentTool<Input = unknown, Output = unknown> {
  name: string
  description: string
  validate(input: unknown): Input
  execute(input: Input, context: ToolExecutionContext): Promise<Output>
}
```

Suggested normalized execution result:

```ts
interface ToolExecutionResult {
  success: boolean
  content: string
  data?: unknown
  error?: string
}
```

This keeps runtime processing, UI presentation, and model feedback consistent.

## Security Boundaries

Phase one must keep a conservative defensive scope.

- `Read`, `Grep`, `Glob`, `Edit`, `Write` operate only inside the workspace.
- `Bash` executes only inside the workspace.
- No unrestricted filesystem access outside the workspace.
- No default network-fetch tool in the first release.
- No destructive directory deletion flow in the first release.
- All write and shell operations must produce structured task and tool records.

## UI Integration

### Chat

The existing chat surface should distinguish:

- user task input
- assistant text
- tool call cards
- tool result cards
- todo updates
- final answer

### ToolPanel

Repurpose as current task execution detail view:

- active task status
- current step
- recent tools
- todo list
- latest errors

### StatusBar

Show lightweight runtime indicators:

- current engine
- task status
- active tool
- step count
- busy state

### Developer panel

Use as a debug surface for:

- raw model output
- normalized runtime actions
- tool payloads
- event timeline

## Delivery Scope

Phase one is complete when the application can:

- create an agent task from user input
- run at least one multi-step model-driven task
- execute the initial built-in toolset
- display task, step, tool, and todo state in the UI
- surface structured errors
- produce a final result

## Implementation Sequence

1. Establish task, step, tool call, and todo state models.
2. Add the agent event namespace and task store.
3. Implement the agent runtime loop and action parser.
4. Implement the built-in tool runtime and workspace-limited tools.
5. Connect runtime events into stores and existing UI surfaces.
6. Add task cancellation, failure handling, and verification.

## Notes on BitFun Reference

BitFun should be treated as a product and interaction reference, not a phase-one compatibility target. The primary lessons to adopt now are:

- explicit task execution visibility
- structured tool invocation records
- separate task state from chat presentation
- runtime-owned control loop

## Final Decision

The approved formal direction is:

- single-agent only in phase one
- TypeScript-led execution runtime
- incremental evolution of the current runtime
- minimal built-in coding toolset
- transparent process-first UI
