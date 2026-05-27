# Built-in Agent Engineering Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the built-in Agent with safe engineering inspection tools and controlled execution tools so it can inspect, diagnose, diff, patch, and validate code tasks more effectively.

**Architecture:** Extend the Rust agent tool registry and built-in runtime with a small set of workspace-safe engineering tools. Keep low-risk inspection tools default-open, keep patch/test tools controlled, and preserve the current frontend event/rendering flow with minimal additions.

**Tech Stack:** Rust, Tauri, serde/serde_json, existing agent runtime/tool registry, React frontend status/tool UI

---

## File Structure

- Modify: `src-tauri/src/services/agent_tool_registry.rs`
- Modify: `src-tauri/src/services/built_in_agent_runtime.rs`
- Modify: `src-tauri/src/services/agent_permission.rs`
- Modify: `src-tauri/src/services/agent_profiles.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src/components/Chat/EnhancedChatMessages.tsx` (only if tool labels/summaries need UI support)
- Reuse where possible: existing file search, diff, git, and diagnostics services under `src/` and `src-tauri/src/services/`

### Task 1: Extend tool registry with engineering inspection tools
- [ ] Add low-risk tool specs for glob/search/read/read_range/diagnostics/git_status/git_diff.
- [ ] Mark these tools model-visible and approval-free by default.
- [ ] Add controlled tool specs for apply_patch/run_tests.
- [ ] Add/adjust unit tests for tool visibility and approval policy.

### Task 2: Implement runtime executors for new tools
- [ ] Wire registry tools to concrete executor branches in built-in runtime.
- [ ] Reuse existing safe services for file search, diagnostics, and git inspection.
- [ ] Return compact structured string results suitable for model continuation.
- [ ] Add runtime tests covering at least one inspection tool and one controlled tool gate.

### Task 3: Tighten permission/profile policy
- [ ] Update built-in Agent profile prompt to mention the new engineering toolbelt.
- [ ] Ensure only low-risk tools are default-open.
- [ ] Keep apply_patch/run_tests approval-gated.
- [ ] Verify tool-choice list and permission responses remain consistent.

### Task 4: Minimal frontend/tool summary support
- [ ] Confirm current tool block UI can render new tool names.
- [ ] Add minimal summary mapping only if current labels are unclear.
- [ ] Run frontend build verification.

### Task 5: Verification
- [ ] Run Rust tests.
- [ ] Run Rust check.
- [ ] Run frontend build.
- [ ] Review tool/result flow for protocol compatibility.
