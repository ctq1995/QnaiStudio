# Runtime Snapshot Store Bridge Design

## Goal

Add a service-level bridge that syncs `EngineeringRuntime.snapshot().taskStates` into `useEngineeringTaskStateStore` without making `ai-runtime` depend on React or Zustand.

## Scope

This phase adds a bridge service and tests. It does not automatically hook the bridge into task execution, adapter callbacks, polling, UI lifecycle, or Always-on workers.

## New file

- `src/services/engineeringTaskStateRuntimeBridge.ts`

## API

```ts
syncEngineeringTaskStateFromRuntime(runtime, store?): boolean
createEngineeringTaskStateRuntimeBridge(runtime, store?): { sync(): boolean }
```

`runtime` only needs:

```ts
snapshot(): { taskStates?: EngineeringTaskState[] }
```

`store` only needs:

```ts
syncFromRuntimeSnapshot(snapshot): void
```

If `store` is omitted, the bridge uses:

```ts
useEngineeringTaskStateStore.getState()
```

## Behavior

`syncEngineeringTaskStateFromRuntime`:

1. Calls `runtime.snapshot()`.
2. Calls `store.syncFromRuntimeSnapshot(snapshot)`.
3. Returns `true` on success.
4. Returns `false` if runtime snapshot or store sync throws.

The bridge must not throw during normal use because task-state UI sync is observational and must not break task execution.

## Layering

The bridge lives in `src/services`, not `src/ai-runtime`, because it depends on the UI store. This keeps the engineering runtime free of React/Zustand dependencies.

## Tests

Add `src/services/engineeringTaskStateRuntimeBridge.test.ts` covering:

1. Syncs runtime snapshot task states into the provided store.
2. Defaults to `useEngineeringTaskStateStore` when no store is provided.
3. Returns `false` when runtime snapshot throws.
4. Returns `false` when store sync throws.
5. `createEngineeringTaskStateRuntimeBridge().sync()` delegates correctly.

## Non-goals

- No automatic task execution hook.
- No polling.
- No Task Center lifecycle integration.
- No persistence.
- No Always-on worker integration.
