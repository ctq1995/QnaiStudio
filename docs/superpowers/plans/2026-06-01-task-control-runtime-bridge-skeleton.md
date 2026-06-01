# Task Control Runtime Bridge Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a no-op runtime bridge that acknowledges task control actions and emits runtime ack audit events.

**Architecture:** A service owns the runtime bridge interface and no-op implementation. Store optionally calls the bridge for pause/resume/cancel, appends returned ack events, and forwards the final event batch to transcript bridge.

**Tech Stack:** TypeScript, Zustand, Vitest.

---

### Task 1: Runtime bridge service

**Files:**
- Create: `src/services/engineeringTaskControlRuntimeBridge.ts`
- Test: `src/services/engineeringTaskControlRuntimeBridge.test.ts`

- [ ] Define `EngineeringTaskControlRuntimeAckEvent`.
- [ ] Define `EngineeringTaskControlRuntimeBridge`.
- [ ] Implement `createNoopEngineeringTaskControlRuntimeBridge()`.
- [ ] Return ack event for pause/resume/cancel.

### Task 2: Store integration

**Files:**
- Modify: `src/stores/engineeringTaskStateStore.ts`
- Modify: `src/stores/engineeringTaskStateStore.test.ts`
- Modify: `src/stores/index.ts`

- [ ] Add `setControlRuntimeBridge(bridge?)`.
- [ ] Add `lastControlRuntimeError?: string`.
- [ ] Call runtime bridge only for pause/resume/cancel.
- [ ] Append ack events to `lastControlAuditEvents`.
- [ ] Forward full event batch to transcript bridge.

### Task 3: Timeline support

**Files:**
- Modify: `src/ai-runtime/engineering/transcript-recorder.ts`
- Modify: `src/ai-runtime/engineering/transcript-timeline.ts`
- Modify: `src/ai-runtime/engineering/transcript-timeline-router.test.ts`

- [ ] Add transcript event type `task_control_runtime_ack`.
- [ ] Map timeline title and summary.

### Task 4: Verification and review

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Compare against PilotDeck capability gaps.
- [ ] Commit with message `feat: add task control runtime bridge`.
