# Engineering Transcript Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight transcript recorder and replay helper for QnaiStudio's self-developed Agent runtime.

**Architecture:** Implement transcript recording as an injectable writer abstraction with an in-memory writer for the first phase. Keep replay read-only and side-effect-free; do not connect to UI, filesystem, Tauri commands, or the execution pipeline yet.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/transcript-recorder.ts`: transcript event types, writer interface, memory writer, recorder, lifecycle/turn conversion helpers.
- Create `src/ai-runtime/engineering/transcript-replay.ts`: read-only replay helper over transcript events.
- Modify `src/ai-runtime/engineering/index.ts`: export recorder and replay modules.

---

### Task 1: Transcript Recorder Module

**Files:**
- Create: `src/ai-runtime/engineering/transcript-recorder.ts`

- [ ] **Step 1: Create transcript recorder implementation**

Create `src/ai-runtime/engineering/transcript-recorder.ts` with the event model, writer abstraction, memory writer, and recorder implementation.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

---

### Task 2: Transcript Replay Module

**Files:**
- Create: `src/ai-runtime/engineering/transcript-replay.ts`

- [ ] **Step 1: Create replay helper**

Create `src/ai-runtime/engineering/transcript-replay.ts` with read-only helpers for ordered iteration and filtering by session or turn.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

---

### Task 3: Exports and Final Validation

**Files:**
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Export modules**

Add:

```ts
export * from './transcript-recorder'
export * from './transcript-replay'
```

- [ ] **Step 2: Run final build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

- [ ] **Step 3: Review, commit, and push**

Run:

```bash
git add src/ai-runtime/engineering/transcript-recorder.ts src/ai-runtime/engineering/transcript-replay.ts src/ai-runtime/engineering/index.ts docs/superpowers/plans/2026-05-29-engineering-transcript-recorder.md
git commit -m "feat: add engineering transcript recorder"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: event model, writer abstraction, memory writer, recorder, lifecycle/turn semantic conversion, deep-copy boundaries, replay filtering, sequence ordering, exports, and build validation are covered.
- Placeholder scan: No implementation placeholders are required in the plan; concrete code is implemented in the focused source modules.
- Scope consistency: persistent storage, UI integration, deterministic replay, model/tool re-execution, and pipeline integration are intentionally out of scope for this phase.
