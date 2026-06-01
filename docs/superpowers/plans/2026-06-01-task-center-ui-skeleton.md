# Task Center UI Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Task Center right-side panel backed by `useEngineeringTaskStateStore`.

**Architecture:** Add a focused `TaskCenterPanel` component and export it through `src/components/TaskCenter/index.ts`. Integrate it into the existing `App.tsx` right-side panel layout without changing runtime behavior.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS.

---

### Task 1: TaskCenterPanel component

**Files:**
- Create: `src/components/TaskCenter/TaskCenterPanel.tsx`
- Create: `src/components/TaskCenter/index.ts`

- [ ] Implement a read-only panel with filter controls.
- [ ] Render empty state when there are no task states.
- [ ] Render task list and active task detail.
- [ ] Keep styling aligned with existing right-side panels.

### Task 2: App integration

**Files:**
- Modify: `src/App.tsx`

- [ ] Import `TaskCenterPanel`.
- [ ] Add `showTaskCenterPanel` and `taskCenterPanelWidth` state.
- [ ] Render Task Center after DeveloperPanel using the existing resize-handle pattern.

### Task 3: Verification

- [ ] Run `npm run build`.
- [ ] Run `npm test`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: add task center panel skeleton`.
