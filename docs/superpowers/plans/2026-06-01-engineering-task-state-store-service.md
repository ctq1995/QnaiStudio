# Engineering Task State Store Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an application-level task state query service and Zustand store for future Task Center UI.

**Architecture:** Keep pure query/subscription logic in `src/services/engineeringTaskStateService.ts`; expose UI-facing state and selectors through `src/stores/engineeringTaskStateStore.ts`. Both consume `EngineeringTaskState` from the engineering runtime.

**Tech Stack:** TypeScript, Zustand, Vitest.

---

### Task 1: Service

**Files:**
- Create: `src/services/engineeringTaskStateService.ts`
- Test: `src/services/engineeringTaskStateService.test.ts`

- [ ] Implement `EngineeringTaskStateFilter` and listener types.
- [ ] Implement `createEngineeringTaskStateService()` with set/upsert/get/filter/subscribe/clear.
- [ ] Sort task states by descending `updatedAt`.
- [ ] Clone arrays to avoid external mutation.

### Task 2: Zustand store

**Files:**
- Create: `src/stores/engineeringTaskStateStore.ts`
- Test: `src/stores/engineeringTaskStateStore.test.ts`

- [ ] Implement `useEngineeringTaskStateStore`.
- [ ] Add `setTaskStates`, `upsertTaskState`, `syncFromRuntimeSnapshot`, `setFilter`, `selectTask`, `clear`.
- [ ] Add `getFilteredTaskStates` and `getActiveTask` selectors.

### Task 3: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: add engineering task state store`.
