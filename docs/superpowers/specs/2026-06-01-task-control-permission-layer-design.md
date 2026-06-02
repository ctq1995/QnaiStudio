# Task Control Permission Layer Design

## Goal

Add a permission/confirmation policy before Task Center control actions reach dispatcher and runtime bridge.

## Scope

This phase adds a pure policy service, store decision state, and transcript/timeline support for permission audit events. It does not show confirmation UI and does not execute real pause/resume/cancel behavior.

## Permission policy

Service:

```text
src/services/engineeringTaskControlPermissionPolicy.ts
```

API:

```ts
decideEngineeringTaskControlPermission(request, options?)
```

Decision statuses:

```text
allowed
requires_confirmation
denied
```

Default policy:

```text
missing taskId     -> denied
cancel             -> requires_confirmation
pause              -> allowed
resume             -> allowed
open_transcript    -> allowed
open_timeline      -> allowed
```

## Store integration

`dispatchTaskAction()` flow:

```text
request
  -> permission decision
  -> lastControlPermissionDecision
  -> permission audit event
  -> if denied: stop
  -> if requires_confirmation: stop for this phase
  -> if allowed: continue dispatcher/runtime/transcript
```

## Event

New audit/transcript event:

```text
task_control_permission_decision
```

Payload:

```text
taskId
action
status
reason
requestedAt
decidedAt
```

## Non-goals

- No confirmation modal.
- No real runtime pause/resume/cancel.
- No task queue mutation.
- No permission persistence.
