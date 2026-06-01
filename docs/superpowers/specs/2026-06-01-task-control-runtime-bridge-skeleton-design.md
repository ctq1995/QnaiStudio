# Task Control Runtime Bridge Skeleton Design

## Goal

Add a safe runtime control boundary for Task Center actions before implementing real pause/resume/cancel behavior.

## Scope

This phase introduces a no-op runtime bridge that acknowledges runtime-control actions and emits `task_control_runtime_ack` audit events. It does not pause, resume, cancel, or navigate anything.

## Service

- `src/services/engineeringTaskControlRuntimeBridge.ts`

## Runtime actions

The runtime bridge only handles:

```text
pause
resume
cancel
```

Navigation actions remain dispatcher-only:

```text
open_transcript
open_timeline
```

## Ack event

```ts
task_control_runtime_ack
```

Payload includes:

```text
taskId
action
status: acknowledged
reason: noop_runtime_handler
requestedAt
acknowledgedAt
```

## Store integration

`useEngineeringTaskStateStore` adds:

```ts
setControlRuntimeBridge(bridge?)
lastControlRuntimeError?: string
```

`dispatchTaskAction()` calls runtime bridge only for pause/resume/cancel. Returned ack events are appended to `lastControlAuditEvents` and forwarded to the transcript bridge.

## Non-goals

- No real runtime interruption.
- No process cancellation.
- No task queue mutation.
- No transcript/timeline navigation.
