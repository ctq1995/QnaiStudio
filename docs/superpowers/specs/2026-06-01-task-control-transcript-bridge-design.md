# Task Control Transcript Bridge Design

## Goal

Record Task Control audit events into `EngineeringTranscriptRecorder` so control actions can be replayed through transcript/timeline readers.

## Scope

This phase adds a bridge service that accepts `EngineeringTaskControlAuditEvent[]` and writes each event to a transcript recorder. It does not wire Zustand store changes automatically to transcript persistence, and it does not execute real pause/resume/cancel behavior.

## Service

- `src/services/engineeringTaskControlTranscriptBridge.ts`

## API

```ts
recordEngineeringTaskControlAuditEvents(recorder, events, context?)
createEngineeringTaskControlTranscriptBridge(recorder, context?)
```

The bridge maps each audit event to transcript fields:

```text
type    -> audit event type
taskId  -> audit event taskId
payload -> full audit event
sessionId / turnId -> optional bridge context
```

## Non-goals

- No automatic store subscription.
- No runtime task control execution.
- No transcript/timeline UI navigation.
- No persistence policy changes.
