# Task Center UI Skeleton Design

## Goal

Add a read-only Task Center panel that displays engineering task states from `useEngineeringTaskStateStore`.

## Scope

This phase adds a visible UI skeleton. It does not add task control actions, persistence, runtime snapshot auto-sync, background workers, or Always-on execution.

## New files

- `src/components/TaskCenter/TaskCenterPanel.tsx`
- `src/components/TaskCenter/index.ts`

## Modified files

- `src/App.tsx`

## Placement

Task Center is an independent right-side panel, following the existing `ToolPanel` and `DeveloperPanel` pattern.

It appears after `DeveloperPanel` in the right-side layout stack when enabled.

## Data source

The panel reads from:

```ts
useEngineeringTaskStateStore
```

It uses:

```ts
taskStates
filter
activeTaskId
setFilter
selectTask
getFilteredTaskStates
getActiveTask
```

## UI behavior

The panel displays:

- task count
- filter controls for status and route
- task list sorted by `updatedAt desc`
- active task detail
- empty state when no tasks exist

Task row fields:

- taskId
- status
- route
- subtype
- currentStage
- updatedAt

Active detail fields:

- status
- route
- subtype
- currentStage
- skippedStages
- verificationStrategy
- reviewStrategy
- updatedAt

## App integration

`App.tsx` adds:

```ts
showTaskCenterPanel
setShowTaskCenterPanel
```

and renders:

```tsx
<TaskCenterPanel />
```

with the same rounded right-panel style as `ToolPanel` and `DeveloperPanel`.

## Non-goals

- No pause/resume/cancel buttons.
- No runtime snapshot polling.
- No persistence.
- No keyboard shortcuts.
- No status bar integration.
- No new backend commands.

## Tests

Add component tests only if the current test setup supports React DOM rendering. If not, rely on TypeScript build and existing store tests for data logic.

## Success criteria

The app builds with a new Task Center panel component available in the main layout, and the panel can render task states already present in `useEngineeringTaskStateStore`.
