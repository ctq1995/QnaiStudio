# Engineering Task State Tracker Design

## Goal

Add an engineering-specific task state tracker that turns runtime events into queryable task states. This prepares QnaiStudio for PilotDeck-like Task Center, Always-on execution, task replay, and future worker dispatch.

## Scope

This phase adds an in-memory tracker only. It does not persist task state, add UI, or change the generic AI `TaskManager` / `TaskQueue` behavior.

## New module

Create:

- `src/ai-runtime/engineering/task-state-tracker.ts`

## State model

```ts
export type EngineeringTaskStatus =
  | 'queued'
  | 'running'
  | 'routed'
  | 'context_building'
  | 'executing'
  | 'diffing'
  | 'verifying'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'aborted'
```

```ts
export interface EngineeringTaskState {
  taskId: string
  sessionId?: string
  turnId?: string
  status: EngineeringTaskStatus
  currentStage?: EngineeringStage
  route?: EngineeringAgentRouteDecision['route']
  subtype?: EngineeringAgentRouteDecision['subtype']
  riskLevel?: EngineeringAgentRouteDecision['riskLevel']
  permissionMode?: EngineeringAgentRouteDecision['permissionMode']
  skippedStages: EngineeringStage[]
  verificationStrategy?: {
    subtype?: string
    commandIds: string[]
  }
  reviewStrategy?: {
    subtype?: string
    focus: string
  }
  error?: string
  startedAt?: string
  updatedAt: string
  completedAt?: string
}
```

## Event inputs

The tracker consumes:

- `EngineeringTurnEvent`
- `EngineeringRunEvent`

## Transition rules

- `turn_started` -> `running`
- `route_decided` -> `routed`
- `stage_started: context` -> `context_building`
- `stage_started: execute` -> `executing`
- `stage_started: diff` -> `diffing`
- `stage_started: verify` -> `verifying`
- `stage_started: review` -> `reviewing`
- `stage_skipped` -> append to `skippedStages`
- `verification_strategy_selected` -> store verification strategy
- `review_strategy_selected` -> store review strategy
- `turn_completed` -> `completed`
- `turn_failed` -> `failed`

## API

```ts
export class EngineeringTaskStateTracker {
  recordTurnEvent(event: EngineeringTurnEvent): EngineeringTaskState | undefined
  recordRunEvent(event: EngineeringRunEvent): EngineeringTaskState | undefined
  getTaskState(taskId: string): EngineeringTaskState | undefined
  getAllTaskStates(): EngineeringTaskState[]
  reset(): void
}
```

## Non-goals

- No persistence.
- No UI.
- No background watcher.
- No generic `TaskManager` rewrite.
- No new worker dispatch behavior.

## Success criteria

1. Route and subtype become visible on task state.
2. Current stage changes when run stage events arrive.
3. Skipped stages and strategies are captured.
4. Completion and failure are reflected in final status.
5. Existing runtime behavior remains unchanged.
