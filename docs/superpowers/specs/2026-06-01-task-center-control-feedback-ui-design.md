# Task Center Control Feedback UI Design

## Goal

Make task control outcomes visible in Task Center after permission, dispatcher, runtime bridge, and transcript bridge events.

## Scope

Add a read-only `Control Feedback` section to the existing task detail panel in `TaskCenterPanel`.

## Displayed data

The section reads from `useEngineeringTaskStateStore`:

```text
lastControlPermissionDecision
lastActionResult
lastControlRuntimeError
lastControlTranscriptError
lastControlAuditEvents
```

## UI behavior

Show compact rows:

```text
Permission: status / reason
Result: status / reason
Runtime error
Transcript error
Recent events
```

Recent events show the latest audit event types and their action/status/reason when available.

## Non-goals

- No confirmation modal.
- No real cancel/pause/resume.
- No navigation to transcript/timeline.
- No new store state.
