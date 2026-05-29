# Engineering Runtime Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate existing engineering runtime modules into a low-risk runtime loop with lifecycle transcript recording, ContextRuntime pipeline adoption, blocking hooks, and Rust/TS bridge protocol types.

**Architecture:** Keep the integration additive and non-invasive. Add `EngineeringRuntime` as a composition layer, extend lifecycle dispatch result with optional blocking semantics, make `EngineeringExecutionPipeline` use `EngineeringContextRuntime.prepare()`, and add bridge event types without wiring UI or Rust listeners.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/engineering-runtime.ts`: unified runtime composition layer.
- Create `src/ai-runtime/engineering/runtime-event-bridge.ts`: Rust/TS bridge event protocol and transcript mapping helpers.
- Modify `src/ai-runtime/engineering/lifecycle-runtime.ts`: add hook decision/blocking result contract.
- Modify `src/ai-runtime/engineering/execution-pipeline.ts`: use `EngineeringContextRuntime.prepare()`.
- Modify `src/ai-runtime/engineering/index.ts`: export new modules.

---

### Task 1: Blocking Lifecycle Hook Contract

**Files:**
- Modify: `src/ai-runtime/engineering/lifecycle-runtime.ts`

- [ ] **Step 1: Add hook decision types**

Add continue/block decisions while treating `void` as continue.

- [ ] **Step 2: Stop dispatch on block**

When a hook returns `{ type: 'block', reason }`, record that hook result and stop executing later hooks.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build passes.

---

### Task 2: ContextRuntime Pipeline Adoption

**Files:**
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts`

- [ ] **Step 1: Add optional `contextRuntime` dependency**

`EngineeringExecutionPipelineDeps` accepts `contextRuntime?: EngineeringContextRuntime`.

- [ ] **Step 2: Replace direct context builder call**

Use `this.deps.contextRuntime || createEngineeringContextRuntime(this.deps.contextBuilder)` and consume `prepare(input).context`.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build passes.

---

### Task 3: Runtime Event Bridge Protocol

**Files:**
- Create: `src/ai-runtime/engineering/runtime-event-bridge.ts`

- [ ] **Step 1: Define bridge event union**

Define model stream, tool, permission, and runtime error bridge events.

- [ ] **Step 2: Map bridge events to transcript record input**

Expose `mapBridgeEventToTranscriptInput(event)`.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build passes.

---

### Task 4: EngineeringRuntime Composition Layer

**Files:**
- Create: `src/ai-runtime/engineering/engineering-runtime.ts`

- [ ] **Step 1: Compose dependencies**

Accept sessionId, turnRunner, lifecycleRuntime, transcriptRecorder, and contextRuntime.

- [ ] **Step 2: Auto-record lifecycle and turn events**

Wrap lifecycle dispatch and turn event callbacks to record transcript events.

- [ ] **Step 3: Implement runTurn(input)**

Dispatch SessionStart, TurnStart, UserPromptSubmit, run turn, dispatch TurnEnd, return result and transcript snapshot.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: build passes.

---

### Task 5: Exports, Review, Commit, Push

**Files:**
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Export new modules**

Add exports for `engineering-runtime` and `runtime-event-bridge`.

- [ ] **Step 2: Run final build and review**

Run: `npm run build`

Review for:

```text
no behavior-breaking pipeline changes
blocking hook keeps void compatibility
transcript auto recording does not throw into main runtime path
bridge protocol does not depend on Rust/Tauri directly
```

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/superpowers/specs/2026-05-29-engineering-runtime-integration-design.md docs/superpowers/plans/2026-05-29-engineering-runtime-integration.md src/ai-runtime/engineering/engineering-runtime.ts src/ai-runtime/engineering/runtime-event-bridge.ts src/ai-runtime/engineering/lifecycle-runtime.ts src/ai-runtime/engineering/execution-pipeline.ts src/ai-runtime/engineering/index.ts
git commit -m "feat: integrate engineering runtime loop"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: runtime loop, automatic transcript, ContextRuntime pipeline adoption, blocking lifecycle hook, bridge protocol, export, and build validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: UI wiring, Rust event emission changes, persistent transcript writer, and model compaction are intentionally out of scope.
