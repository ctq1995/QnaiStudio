# Task Control Dispatcher Design

## Goal

Introduce a non-destructive task control dispatcher boundary for Task Center actions.

## Scope

This phase records and dispatches Task Center actions through a service layer. It does not pause, resume, cancel, or navigate runtime/UI resources.

## New service

- `src/services/engineeringTaskControlDispatcher.ts`

## Actions

The dispatcher consumes existing Task Center action requests:

```ts
EngineeringTaskCenterActionRequest
```

Supported actions:

```text
pause
resume
cancel
open_transcript
open_timeline
```

## Result model

```ts
EngineeringTaskControlDispatchResult {
  taskId: string
  action: EngineeringTaskCenterAction
  status: 'accepted' | 'rejected' | 'noop'
  reason: string
  requestedAt: string
  handledAt: string
}
```

Initial behavior:

```text
pause/resume/cancel:
  accepted + noop_control_handler

open_transcript/open_timeline:
  accepted + navigation_pending
```

Invalid or missing task id returns:

```text
rejected + missing_task_id
```

## Store integration

`src/stores/engineeringTaskStateStore.ts` adds:

```ts
lastActionResult?: EngineeringTaskControlDispatchResult
requestTaskAction(taskId, action)
dispatchTaskAction(taskId, action)
```

`requestTaskAction` only records the request.

`dispatchTaskAction` records the request, calls the dispatcher, and stores the result.

## UI integration

`TaskCenterPanel` uses `dispatchTaskAction` for action buttons and renders the latest action result in the active task detail panel.

## Non-goals

- No real pause/resume/cancel runtime control.
- No transcript/timeline navigation.
- No confirmation dialogs.
- No persistence.
- No permission prompts.
