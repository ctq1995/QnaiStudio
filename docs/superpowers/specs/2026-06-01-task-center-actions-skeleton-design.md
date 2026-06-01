# Task Center Actions Skeleton Design

## Goal

Add non-destructive action entry points to Task Center so the UI can expose task control affordances without executing pause/resume/cancel behavior yet.

## Scope

This phase adds an action contract, a store-level dispatch stub, and Task Center buttons. Actions are recorded as last requested action but do not mutate task lifecycle or call runtime control APIs.

## Actions

```ts
pause
resume
cancel
open_transcript
open_timeline
```

## Behavior

- `pause`, `resume`, and `cancel` render disabled unless the selected task status makes the action conceptually valid.
- Clicking enabled actions records `{ taskId, action, requestedAt }` in store state.
- `open_transcript` and `open_timeline` are enabled for any selected task.
- No destructive runtime operation is performed.

## Files

- Modify `src/stores/engineeringTaskStateStore.ts`.
- Modify `src/components/TaskCenter/TaskCenterPanel.tsx`.
- Add/update tests for store action dispatch.

## Non-goals

- No actual pause/resume/cancel runtime execution.
- No transcript/timeline navigation integration.
- No confirmation dialogs.
- No persistence.
