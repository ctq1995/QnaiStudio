# Task Control Store Transcript Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forward task control audit events from the task state store to an injected transcript bridge.

**Architecture:** Store accepts a bridge interface and calls it after `dispatchTaskAction()` creates audit events. Store records bridge errors without blocking UI action state updates.

**Tech Stack:** TypeScript, Zustand, Vitest.

---

### Task 1: Store bridge wiring

**Files:**
- Modify: `src/stores/engineeringTaskStateStore.ts`
- Modify: `src/stores/engineeringTaskStateStore.test.ts`

- [ ] Import `EngineeringTaskControlTranscriptBridge` type.
- [ ] Add `setControlTranscriptBridge(bridge?)`.
- [ ] Add `lastControlTranscriptError?: string`.
- [ ] Call `bridge.record(events)` from `dispatchTaskAction()`.
- [ ] Capture rejected promises in `lastControlTranscriptError`.

### Task 2: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: wire task control transcript bridge`.
