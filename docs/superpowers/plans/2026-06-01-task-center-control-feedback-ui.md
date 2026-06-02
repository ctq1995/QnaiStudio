# Task Center Control Feedback UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show task control permission, dispatcher, runtime, transcript, and audit feedback inside Task Center.

**Architecture:** Reuse existing `useEngineeringTaskStateStore` state and add a read-only `Control Feedback` section inside `TaskCenterPanel`. Keep the UI local to the component, using small formatter helpers and no new store state.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, Vitest.

---

### Task 1: Task Center control feedback UI

**Files:**
- Modify: `src/components/TaskCenter/TaskCenterPanel.tsx`

- [ ] Read `lastControlPermissionDecision`, `lastControlAuditEvents`, `lastControlRuntimeError`, and `lastControlTranscriptError` from the store selector.
- [ ] Add a `Control Feedback` section in the active task detail pane.
- [ ] Render permission status/reason, last action result status/reason, runtime error, transcript error, and recent audit event rows.
- [ ] Add small local helpers to format event rows.

### Task 2: Verification

**Files:**
- Verify: `src/components/TaskCenter/TaskCenterPanel.tsx`

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for `TODO`, `debugger`, `console`, and focused tests.
- [ ] Commit with message `feat: show task control feedback`.
