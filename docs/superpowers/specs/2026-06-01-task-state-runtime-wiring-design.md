# Engineering Task State Runtime Wiring Design

## Goal

Wire `EngineeringTaskStateTracker` into the main engineering runtime so task state updates automatically during a turn. This prepares the runtime for Task Center, Always-on execution, and future worker dispatch.

## Scope

This phase wires an in-memory tracker into the runtime. It does not add persistence, UI, Always-on watchers, multi-worker dispatch, or transcript-derived state reconstruction.

## Current state

`EngineeringTaskStateTracker` already exists and can consume:

- `EngineeringTurnEvent`
- `EngineeringRunEvent`

The runtime currently records turn events into transcripts, but does not automatically update task state.

## Architecture

Add an optional tracker to `EngineeringRuntime` and adapter/bootstrap inputs:

```ts
taskStateTracker?: EngineeringTaskStateTracker
```

Runtime event flow becomes:

```text
TurnRunner onTurnEvent
  -> taskStateTracker.recordTurnEvent(event)
  -> transcriptRecorder.recordTurnEvent(event)
  -> caller onTurnEvent(event)

Pipeline onEvent
  -> taskStateTracker.recordRunEvent(event)
  -> caller onEvent(event)
```

## Snapshot

Extend `EngineeringRuntimeSnapshot`:

```ts
export interface EngineeringRuntimeSnapshot {
  sessionId: string
  lifecycle: ReturnType<EngineeringLifecycleRuntime['snapshot']>
  taskStates: EngineeringTaskState[]
}
```

If no tracker is supplied, runtime creates a default in-memory tracker.

## Adapter and bootstrap

Expose tracker through:

- `EngineeringRuntimeFromTurnRunnerDepsInput`
- `EngineeringTaskRunnerAdapterInput`
- `EngineeringPipelineRunnerRegistrationInput`

This allows application-level code to pass a shared tracker for future Task Center use.

## Event ownership

The runtime owns wiring, not the generic `TaskManager` or `TaskQueue`. This keeps engineering-specific state out of generic AI task infrastructure.

## Error handling

Tracker updates are synchronous and should not throw for valid runtime events. If a tracker call throws unexpectedly, runtime should catch it and continue transcript/user callbacks to avoid breaking task execution.

## Tests

Add tests that verify:

1. Turn events update task state through runtime wiring.
2. Pipeline run events update task state through runtime wiring.
3. `runtime.snapshot().taskStates` returns tracked states.
4. Caller-provided event handlers still run.
5. Tracker errors do not stop transcript recording or user callbacks.

## Non-goals

- No persistence.
- No UI Task Center.
- No Always-on watcher.
- No multi-worker registry.
- No state reconstruction from transcript snapshots.
