# Session Replay Buffer and Transcript Auto Wiring Plan

## Goal

Continue reference-case alignment by making runtime events easier to replay by session and automatically recordable into engineering transcripts.

## Priority 1: EventBus session replay helpers

1. Add `getSessionHistory(sessionId)` to EventBus.
2. Add `onSession(sessionId, listener)` to subscribe only to events for a session.
3. Keep existing EventBus API compatible.
4. Do not introduce a new persistence layer in this iteration.

## Priority 2: Waitable runner session replay

1. Replace direct `getHistory()` filtering with `getSessionHistory(sessionId)`.
2. Replace `onAny()` manual session filter with `onSession(sessionId, listener)`.
3. Preserve listener cleanup.
4. Preserve custom `collectOutput` override semantics.

## Priority 3: AIEvent transcript auto wiring

1. Add a service helper to register an EventBus listener that records scoped AIEvents into `EngineeringTranscriptRecorder`.
2. Only record events with sessionId by default.
3. Map AIEvent categories into existing transcript event types without changing recorder storage format.
4. Return cleanup function.
5. Isolate recorder errors through optional `onError`.
6. Allow callers to filter events and map payloads for redaction/control.

## Non-goals

- No EventBus persistence store.
- No UI replay timeline in this iteration.
- No change to EventBus emit semantics.
- No automatic credential filtering beyond existing event payloads.

## Success criteria

1. `npm run build` passes.
2. Existing EventBus consumers remain compatible.
3. Waitable runner uses session-scoped replay helper.
4. Transcript auto wiring can be composed with EngineeringRuntime / RuntimeBridge later.
5. Transcript auto wiring supports caller-provided filtering and payload mapping.
