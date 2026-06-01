# Task Control Audit Events Design

## Goal

Make Task Center control actions observable by producing typed audit events for requested and dispatched control actions.

## Scope

This phase adds event types and local store recording for task control audit events. It also teaches transcript/timeline rendering to classify these events when they are recorded. It does not execute real pause/resume/cancel behavior and does not wire a transcript writer into the UI store.

## Events

```ts
task_control_requested
task_control_dispatched
```

`task_control_requested` records the original action request.

`task_control_dispatched` records the dispatcher result.

## Data flow

```text
TaskCenterPanel
  -> dispatchTaskAction(taskId, action)
  -> EngineeringTaskControlDispatcher
  -> result + audit events
  -> store.lastControlAuditEvents
```

Transcript/timeline support accepts these events as transcript event types so future runtime/UI wiring can record them without another schema change.

## Non-goals

- No real runtime pause/resume/cancel.
- No automatic transcript writer wiring from Zustand store.
- No permission prompt.
- No persistence.
