# Task Control Permission Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permission policy before task control actions reach dispatcher/runtime bridge.

**Architecture:** A pure permission policy service decides whether a control action is allowed, denied, or requires confirmation. Store records the decision, emits a permission audit event, and only continues to dispatcher/runtime when the decision is allowed. Transcript/timeline support renders the permission decision event.

**Tech Stack:** TypeScript, Zustand, Vitest.

---

### Task 1: Permission policy service

**Files:**
- Create: `src/services/engineeringTaskControlPermissionPolicy.ts`
- Test: `src/services/engineeringTaskControlPermissionPolicy.test.ts`

- [ ] Add `EngineeringTaskControlPermissionDecision`.
- [ ] Add `decideEngineeringTaskControlPermission(request)`.
- [ ] Cover allowed, denied, and requires_confirmation decisions.

### Task 2: Store integration

**Files:**
- Modify: `src/stores/engineeringTaskStateStore.ts`
- Modify: `src/stores/engineeringTaskStateStore.test.ts`
- Modify: `src/stores/index.ts`

- [ ] Add `lastControlPermissionDecision`.
- [ ] Add permission decision event to `lastControlAuditEvents`.
- [ ] Stop dispatch/runtime flow when decision is denied or requires confirmation.
- [ ] Continue existing dispatcher/runtime/transcript flow only when allowed.

### Task 3: Transcript and timeline support

**Files:**
- Modify: `src/services/engineeringTaskControlTranscriptBridge.ts`
- Modify: `src/ai-runtime/engineering/transcript-recorder.ts`
- Modify: `src/ai-runtime/engineering/transcript-timeline.ts`
- Modify: `src/ai-runtime/engineering/transcript-timeline-router.test.ts`

- [ ] Add event type `task_control_permission_decision`.
- [ ] Include permission decision event in transcript bridge union.
- [ ] Render permission decision in timeline.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: add task control permission layer`.
