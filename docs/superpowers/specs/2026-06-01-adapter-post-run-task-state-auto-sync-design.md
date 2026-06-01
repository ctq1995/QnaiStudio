# Adapter Post-run Task State Auto Sync Design

## Goal

Automatically sync engineering runtime task states into the UI task state store after an engineering task run completes.

## Scope

This phase adds an adapter lifecycle hook and wires it from bootstrap to the runtime-store bridge. It does not add polling, UI changes, persistence, or Always-on workers.

## Architecture

`src/ai-runtime/engineering/task-runner-adapter.ts` remains UI-store agnostic by exposing a generic post-run hook:

```ts
afterRuntimeTurn?: (runtime: EngineeringRuntimeLike) => void
```

`src/core/engineering-runtime-bootstrap.ts` wires the hook to:

```ts
syncEngineeringTaskStateFromRuntime(runtime)
```

This keeps `ai-runtime` independent from React/Zustand while still giving app bootstrap automatic Task Center sync.

## Execution flow

```text
EngineeringTaskRunnerAdapter
  -> createEngineeringRuntime(...)
  -> runtime.runTurn(input)
  -> afterRuntimeTurn(runtime)
  -> return EngineeringTaskRunnerResult
```

The hook runs after `runtime.runTurn()` resolves and before returning the task runner result.

## Error handling

`afterRuntimeTurn` failures must not change the task result. The hook is observational and must not break task execution.

## Bootstrap behavior

`registerEngineeringPipelineRunner()` sets:

```ts
afterRuntimeTurn: input.afterRuntimeTurn || syncEngineeringTaskStateFromRuntime
```

Callers may provide their own hook. If they need to disable automatic sync, they can provide a no-op hook.

## Tests

Add tests for:

1. Adapter invokes `afterRuntimeTurn` after successful `runTurn`.
2. Adapter still returns task result when hook throws.
3. Bootstrap passes default `syncEngineeringTaskStateFromRuntime` hook into adapter.
4. Bootstrap respects caller-provided hook override.

## Non-goals

- No UI changes.
- No polling.
- No persistence.
- No background worker.
- No direct `ai-runtime` import from UI store.
