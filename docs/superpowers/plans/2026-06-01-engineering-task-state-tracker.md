# Engineering Task State Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-memory engineering task state tracker that converts runtime events into queryable task states.

**Architecture:** Implement a focused tracker module under `src/ai-runtime/engineering`. The tracker consumes existing `EngineeringTurnEvent` and `EngineeringRunEvent` objects, updates task state snapshots, and exposes query/reset methods without changing the generic AI task queue.

**Tech Stack:** TypeScript, Vitest, existing engineering runtime event types.

---

### Task 1: Tracker module

**Files:**
- Create: `src/ai-runtime/engineering/task-state-tracker.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] Define `EngineeringTaskStatus` and `EngineeringTaskState`.
- [ ] Implement `EngineeringTaskStateTracker` with `recordTurnEvent`, `recordRunEvent`, `getTaskState`, `getAllTaskStates`, and `reset`.
- [ ] Export the module from the engineering index.

### Task 2: Tracker tests

**Files:**
- Create: `src/ai-runtime/engineering/task-state-tracker.test.ts`

- [ ] Test route decision updates route/subtype/risk/permission/skipped stages.
- [ ] Test stage events update current stage and status.
- [ ] Test verification/review strategy events update strategy fields.
- [ ] Test turn completion/failure final statuses.
- [ ] Test `reset()` clears state.

### Task 3: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit implementation with message `feat: add engineering task state tracker`.
