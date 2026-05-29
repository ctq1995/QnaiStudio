# Rust Tool Call Integrity Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Rust-side Tool Call Integrity Guard that repairs built-in Agent chat messages before model requests are sent.

**Architecture:** Implement a focused Rust service module that scans `ChatMessage` history, preserves valid assistant tool calls and tool results, removes orphan/duplicate tool results, and inserts synthetic error tool messages for missing results. Integrate it at `build_model_request()` so the actual built-in Agent OpenAI-compatible request path is protected without mutating persisted session history.

**Tech Stack:** Rust, Tauri backend services, existing `ChatMessage` / `ToolCall` structs, Cargo check, Vite build validation.

---

## File Structure

- Create `src-tauri/src/services/tool_call_integrity.rs`: guard implementation and unit tests.
- Modify `src-tauri/src/services/mod.rs`: export the new service module.
- Modify `src-tauri/src/services/built_in_agent_runtime.rs`: call the guard in `build_model_request()` before creating `ModelRequest`.

---

### Task 1: Rust Tool Call Integrity Module

**Files:**
- Create: `src-tauri/src/services/tool_call_integrity.rs`

- [ ] **Step 1: Implement message repair module**

Create a module that imports `ChatMessage`, scans messages in order, and returns `ToolCallIntegrityReport` with repaired messages and repair records.

- [ ] **Step 2: Add unit tests**

Add tests in the same file covering:

```text
valid paired tool call is preserved
missing tool result inserts synthetic error tool message
orphan tool result is removed
duplicate tool result is removed
pending tool calls at end are repaired
```

- [ ] **Step 3: Run Rust tests/check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: check passes.

---

### Task 2: Wire Guard into Built-in Agent Request Path

**Files:**
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/services/built_in_agent_runtime.rs`

- [ ] **Step 1: Export service module**

Add to `src-tauri/src/services/mod.rs`:

```rust
pub mod tool_call_integrity;
```

- [ ] **Step 2: Repair messages in `build_model_request()`**

Import and call:

```rust
use crate::services::tool_call_integrity::repair_tool_call_integrity;
```

Then replace raw `messages` with repaired messages before building `ModelRequest`.

- [ ] **Step 3: Run full validation**

Run:

```text
cargo check --manifest-path src-tauri/Cargo.toml
npm run build
```

Expected: both pass; existing Vite chunk warnings are acceptable.

---

### Task 3: Review, Commit, and Push

**Files:**
- Review all changed files.

- [ ] **Step 1: Run targeted review**

Review for:

```text
valid message ordering
synthetic tool result content
no session history mutation
no unrelated rustfmt churn
```

- [ ] **Step 2: Commit and push**

Run:

```bash
git add src-tauri/src/services/tool_call_integrity.rs src-tauri/src/services/mod.rs src-tauri/src/services/built_in_agent_runtime.rs docs/superpowers/plans/2026-05-29-rust-tool-call-integrity.md
git commit -m "feat: guard rust tool call integrity"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: missing tool results, orphan tool results, duplicate tool results, end-of-request pending calls, synthetic error messages, built-in Agent request path integration, and validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: OpenAI Responses conversion, UI integration, persistent audit, history mutation, and full runtime replay are intentionally out of scope for this phase.
