# Runtime Live Task State Sync Design

## Goal

Update the Task Center store while an engineering task is running, not only after the runtime turn completes.

## Scope

This phase adds a runtime-level task-state changed hook and wires app bootstrap to the task state store. It does not add polling, UI changes, persistence, or Always-on workers.

## Architecture

`src/ai-runtime/engineering/engineering-runtime.ts` owns the in-memory `EngineeringTaskStateTracker`. It will expose an observational callback:

```ts
onTaskStateChanged?: (states: EngineeringTaskState[]) => void
```

The runtime invokes the callback after successful task-state updates caused by turn/run events.

`src/core/engineering-runtime-bootstrap.ts` wires the callback to the task state store by default. This keeps `src/ai-runtime` free from React/Zustand imports.

## Event flow

```text
TurnRunner emits route_decided
  -> EngineeringRuntime records task state
  -> EngineeringRuntime calls onTaskStateChanged(states)
  -> Bootstrap/store sync updates Task Center
```

The same applies to run events such as:

```text
stage_started
stage_skipped
verification_strategy_selected
review_strategy_selected
stage_failed
```

## Error handling

`onTaskStateChanged` failures must be swallowed. Task-state UI sync is observational and must not alter runtime task execution.

## Adapter behavior

The existing adapter post-run sync remains as final-state fallback:

```text
runtime.runTurn()
  -> live task state sync during run
  -> afterRuntimeTurn(runtime) final snapshot sync
```

## Tests

Add tests for:

1. Runtime calls `onTaskStateChanged` after turn events update task state.
2. Runtime calls `onTaskStateChanged` after run events update task state.
3. Runtime continues when `onTaskStateChanged` throws.
4. Bootstrap default wiring updates the task state store before task completion events finish the run.
5. Bootstrap caller override is respected.

## Non-goals

- No Task Center UI changes.
- No polling.
- No persistence.
- No Always-on worker integration.
- No direct `ai-runtime` import from UI store.
