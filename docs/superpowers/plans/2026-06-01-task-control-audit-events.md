# Task Control Audit Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed audit events for Task Center control requests and dispatcher results.

**Architecture:** Dispatcher returns both result and audit events. Store records the latest audit event batch. Transcript/timeline accepts task control event types for future recorder wiring.

**Tech Stack:** TypeScript, Zustand, Vitest.

---

### Task 1: Dispatcher audit events

**Files:**
- Modify: `src/services/engineeringTaskControlDispatcher.ts`
- Modify: `src/services/engineeringTaskControlDispatcher.test.ts`

- [ ] Add `EngineeringTaskControlAuditEvent` type.
- [ ] Add `dispatchEngineeringTaskControlActionWithAudit(request)`.
- [ ] Keep existing `dispatchEngineeringTaskControlAction(request)` behavior.

### Task 2: Store audit event recording

**Files:**
- Modify: `src/stores/engineeringTaskStateStore.ts`
- Modify: `src/stores/engineeringTaskStateStore.test.ts`
- Modify: `src/stores/index.ts`

- [ ] Add `lastControlAuditEvents`.
- [ ] Store audit events from dispatch action.
- [ ] Clear audit events on `clear()`.

### Task 3: Transcript/timeline support

**Files:**
- Modify: `src/ai-runtime/engineering/transcript-recorder.ts`
- Modify: `src/ai-runtime/engineering/transcript-timeline.ts`
- Add/update tests for timeline mapping.

- [ ] Add transcript event types.
- [ ] Map timeline kind/title/summary.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: audit task control actions`.
