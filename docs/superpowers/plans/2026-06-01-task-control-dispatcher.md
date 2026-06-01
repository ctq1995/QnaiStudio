# Task Control Dispatcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-destructive task control dispatcher for Task Center actions.

**Architecture:** A service accepts typed Task Center action requests and returns typed dispatch results. The task state store records requests and results, while Task Center UI displays the latest result.

**Tech Stack:** TypeScript, React, Zustand, Vitest.

---

### Task 1: Dispatcher service

**Files:**
- Create: `src/services/engineeringTaskControlDispatcher.ts`
- Test: `src/services/engineeringTaskControlDispatcher.test.ts`

- [ ] Add `EngineeringTaskControlDispatchResult` type.
- [ ] Add `dispatchEngineeringTaskControlAction(request)`.
- [ ] Return `rejected/missing_task_id` for missing task id.
- [ ] Return `accepted/noop_control_handler` for pause/resume/cancel.
- [ ] Return `accepted/navigation_pending` for open_transcript/open_timeline.

### Task 2: Store integration

**Files:**
- Modify: `src/stores/engineeringTaskStateStore.ts`
- Modify: `src/stores/engineeringTaskStateStore.test.ts`
- Modify: `src/stores/index.ts`

- [ ] Add `lastActionResult`.
- [ ] Add `dispatchTaskAction(taskId, action)`.
- [ ] Clear result in `clear()`.
- [ ] Export result type.

### Task 3: UI integration

**Files:**
- Modify: `src/components/TaskCenter/TaskCenterPanel.tsx`

- [ ] Use `dispatchTaskAction` for buttons.
- [ ] Render latest result for active task.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: dispatch task center actions`.
