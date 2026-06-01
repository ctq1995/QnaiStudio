# Engineering Task State Store and Query Service Design

## Goal

Expose engineering runtime task states as an application-level query and subscription source for future Task Center UI and Always-on workflows.

## Scope

This phase adds a service and Zustand store. It does not add UI, persistence, background watchers, or multi-worker dispatch.

## New files

- `src/services/engineeringTaskStateService.ts`
- `src/stores/engineeringTaskStateStore.ts`

## Service responsibilities

The service owns pure task-state query and subscription logic.

```ts
createEngineeringTaskStateService()
```

API:

```ts
setTaskStates(states: EngineeringTaskState[]): void
upsertTaskState(state: EngineeringTaskState): void
getTaskState(taskId: string): EngineeringTaskState | undefined
getTaskStates(filter?: EngineeringTaskStateFilter): EngineeringTaskState[]
subscribe(listener: EngineeringTaskStateListener): () => void
clear(): void
```

Filter:

```ts
export interface EngineeringTaskStateFilter {
  status?: EngineeringTaskStatus | EngineeringTaskStatus[]
  route?: EngineeringTaskState['route'] | EngineeringTaskState['route'][]
  subtype?: EngineeringTaskState['subtype'] | EngineeringTaskState['subtype'][]
}
```

## Store responsibilities

The Zustand store owns UI-facing state and delegates query logic to the service.

```ts
useEngineeringTaskStateStore
```

State:

```ts
taskStates: EngineeringTaskState[]
activeTaskId?: string
filter: EngineeringTaskStateFilter
```

Actions:

```ts
setTaskStates(states)
upsertTaskState(state)
syncFromRuntimeSnapshot(snapshot)
setFilter(filter)
selectTask(taskId)
clear()
getFilteredTaskStates()
getActiveTask()
```

## Runtime snapshot sync

The store accepts any object with:

```ts
{ taskStates?: EngineeringTaskState[] }
```

This avoids coupling the store directly to `EngineeringRuntimeSnapshot` while still supporting:

```ts
useEngineeringTaskStateStore.getState().syncFromRuntimeSnapshot(runtime.snapshot())
```

## Data flow

```text
EngineeringRuntime.snapshot().taskStates
  -> engineeringTaskStateService.setTaskStates()
  -> useEngineeringTaskStateStore.syncFromRuntimeSnapshot()
  -> future Task Center UI
```

## Ordering

Task states are returned in descending `updatedAt` order. This makes the most recently changed task appear first in future UI.

## Error handling

The service accepts empty arrays and missing snapshots. Invalid filters return an empty result only when no task matches; they do not throw.

## Tests

Add tests for:

1. Service set/upsert/get/filter behavior.
2. Service subscription and unsubscribe behavior.
3. Store sync from runtime snapshot.
4. Store active task selection.
5. Store filtered query behavior.
6. Store clear behavior.

## Non-goals

- No UI panel.
- No persistence.
- No localStorage.
- No cross-window sync.
- No Always-on watcher.
