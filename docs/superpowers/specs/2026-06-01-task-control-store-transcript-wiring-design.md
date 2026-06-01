# Task Control Store Transcript Wiring Design

## Goal

Automatically forward Task Center control audit events from the task state store to an injected transcript bridge.

## Scope

This phase wires `dispatchTaskAction()` to a configurable `EngineeringTaskControlTranscriptBridge`. It does not create or own an `EngineeringTranscriptRecorder`, and it does not execute real task control actions.

## Store API

Add to `useEngineeringTaskStateStore`:

```ts
setControlTranscriptBridge(bridge?)
lastControlTranscriptError?: string
```

When `dispatchTaskAction()` produces audit events, the store calls:

```ts
bridge.record(events)
```

The call is fire-and-forget. Failures are captured in `lastControlTranscriptError` and must not break UI state updates.

## Clear behavior

`clear()` removes:

```text
lastActionRequest
lastActionResult
lastControlAuditEvents
lastControlTranscriptError
controlTranscriptBridge
```

## Non-goals

- No direct transcript recorder construction in the store.
- No persistence policy changes.
- No real pause/resume/cancel behavior.
- No transcript/timeline navigation.
