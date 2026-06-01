# Task Center Actions Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add non-destructive Task Center action controls and a typed action request contract.

**Architecture:** Store records the last requested task action. UI renders action buttons and dispatches action requests without mutating task state.

**Tech Stack:** TypeScript, React, Zustand, Vitest.

---

### Task 1: Store action contract

**Files:**
- Modify: `src/stores/engineeringTaskStateStore.ts`
- Test: `src/stores/engineeringTaskStateStore.test.ts`

- [ ] Add `EngineeringTaskCenterAction` and `EngineeringTaskCenterActionRequest` types.
- [ ] Add `lastActionRequest` store state.
- [ ] Add `requestTaskAction(taskId, action)` store action.
- [ ] Clear action request on `clear()`.

### Task 2: Task Center buttons

**Files:**
- Modify: `src/components/TaskCenter/TaskCenterPanel.tsx`

- [ ] Render action buttons in active task detail.
- [ ] Enable/disable pause/resume/cancel based on task status.
- [ ] Enable open transcript/open timeline for selected task.
- [ ] Dispatch action requests only for enabled actions.

### Task 3: Verification and review

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Compare against PilotDeck capability gaps.
