# Task Center Navigation Intent Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record `open_transcript` and `open_timeline` as explicit navigation intents and show them in Task Center.

**Architecture:** Store owns a lightweight `lastNavigationIntent` state derived from allowed navigation actions. Task Center reads that state and displays it inside the existing Control Feedback section. No router or panel switching is introduced in this phase.

**Tech Stack:** TypeScript, Zustand, React, Vitest.

---

### Task 1: Store navigation intent

**Files:**
- Modify: `src/stores/engineeringTaskStateStore.ts`
- Modify: `src/stores/engineeringTaskStateStore.test.ts`
- Modify: `src/stores/index.ts`

- [ ] Add `EngineeringTaskNavigationTarget` and `EngineeringTaskNavigationIntent`.
- [ ] Add `lastNavigationIntent?: EngineeringTaskNavigationIntent` to store state.
- [ ] Set navigation intent for allowed `open_transcript` and `open_timeline` actions after dispatcher accepts them.
- [ ] Clear navigation intent in `clear()`.
- [ ] Cover transcript and timeline navigation intent in store tests.

### Task 2: Task Center display

**Files:**
- Modify: `src/components/TaskCenter/TaskCenterPanel.tsx`

- [ ] Read `lastNavigationIntent` from store.
- [ ] Pass active-task navigation intent into `TaskDetail`.
- [ ] Show `Navigation pending` target and requested timestamp in `Control feedback`.

### Task 3: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: add task navigation intent`.
