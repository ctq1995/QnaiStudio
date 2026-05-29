# Engineering Context Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight Engineering Context Runtime that unifies existing context preparation, message projection, tool result budgeting, and overflow recovery helpers.

**Architecture:** Implement a focused TypeScript wrapper module around existing context utilities. Keep the runtime non-invasive: it delegates to `buildEngineeringContext()`, `projectEngineeringMessages()`, `budgetToolResult()`, and `buildOverflowRecoveryAdvice()` without changing their behavior or replacing current pipeline calls.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/context-runtime.ts`: runtime class, factory, prepare result, snapshot types.
- Modify `src/ai-runtime/engineering/index.ts`: export context runtime.

---

### Task 1: Context Runtime Module

**Files:**
- Create: `src/ai-runtime/engineering/context-runtime.ts`

- [ ] **Step 1: Implement lightweight runtime wrapper**

Create a module that delegates to existing context utilities and exposes `prepare`, `projectMessages`, `budgetToolResult`, `buildOverflowAdvice`, and `snapshot`.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

---

### Task 2: Export and Validate

**Files:**
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Export context runtime**

Add:

```ts
export * from './context-runtime'
```

- [ ] **Step 2: Run final build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

- [ ] **Step 3: Review, commit, and push**

Run:

```bash
git add src/ai-runtime/engineering/context-runtime.ts src/ai-runtime/engineering/index.ts docs/superpowers/plans/2026-05-29-engineering-context-runtime.md
git commit -m "feat: add engineering context runtime"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: prepare, message projection, tool result budgeting, overflow advice, snapshot, export, and build validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: UI integration, Tauri integration, provider behavior changes, model-based compaction, persistent cache, and pipeline replacement are intentionally out of scope.
