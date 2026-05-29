# Built-in Agent Streaming Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable first-phase streaming for built-in Agent OpenAI Chat text responses while preserving non-streaming behavior for tool-call execution.

**Architecture:** Extend the model adapter trait with a streaming callback method, implement OpenAI Chat SSE parsing, and wire the built-in runtime to emit `TextDelta` events as deltas arrive. Streaming tool-call chunks are accumulated into the existing `ToolCall` shape so the current tool execution state machine continues to work.

**Tech Stack:** Rust, Tauri backend, reqwest streaming, existing `StreamEvent::TextDelta`, npm/Vite and Cargo validation.

---

## File Structure

- Modify `src-tauri/Cargo.toml`: enable reqwest streaming support.
- Modify `src-tauri/src/services/agent_model_adapter.rs`: add streaming trait method and OpenAI Chat SSE parser.
- Modify `src-tauri/src/services/built_in_agent_runtime.rs`: call streaming adapter and append deltas to event list.

---

### Task 1: Adapter Streaming Support

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/services/agent_model_adapter.rs`

- [ ] **Step 1: Enable reqwest stream feature**

Change reqwest dependency in `src-tauri/Cargo.toml` from:

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
```

to:

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls", "stream"] }
```

- [ ] **Step 2: Extend ModelAdapter trait**

Add a default `stream_chat_completion` method that calls `request_chat_completion`.

- [ ] **Step 3: Add OpenAI Chat streaming response structs**

Add deserialize structs for streaming chunks:

```rust
struct ChatCompletionStreamChunk { choices: Vec<ChatCompletionStreamChoice> }
struct ChatCompletionStreamChoice { delta: ChatCompletionStreamDelta }
struct ChatCompletionStreamDelta { content: Option<String>, tool_calls: Option<Vec<serde_json::Value>> }
```

- [ ] **Step 4: Implement OpenAI Chat streaming**

Override `stream_chat_completion` for `OpenAiCompatibleModelAdapter`:

- `stream: true`
- read SSE chunks using `response.chunk().await`
- parse `data:` lines from UTF-8 complete SSE lines
- emit `delta.content` through callback
- append full text for final `ModelResponse`
- accumulate streamed `tool_calls` into complete `ToolCall` values
- enforce bounded SSE line, content, tool-call, and error-body sizes

- [ ] **Step 5: Validate backend**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: Cargo check passes.

---

### Task 2: Runtime Integration

**Files:**
- Modify: `src-tauri/src/services/built_in_agent_runtime.rs`

- [ ] **Step 1: Use streaming in initial model call**

Replace initial `adapter.request_chat_completion(request)` with `adapter.stream_chat_completion(request, Box::new(|delta| events.push(StreamEvent::TextDelta { text: delta })))`.

- [ ] **Step 2: Use streaming after tool rounds**

Replace subsequent model calls inside `continue_model_loop` with the same streaming callback.

- [ ] **Step 3: Avoid duplicate full text emission**

Update `continue_model_loop` so it only pushes full assistant text when it was not already streamed by the adapter.

- [ ] **Step 4: Validate backend**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: Cargo check passes.

---

### Task 3: Final Validation and Commit

**Files:**
- Validate all modified Rust files and docs.

- [ ] **Step 1: Run frontend build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 2: Run backend check**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: Cargo check passes.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/agent_model_adapter.rs src-tauri/src/services/built_in_agent_runtime.rs docs/superpowers/plans/2026-05-29-built-in-agent-streaming-phase-1.md
git commit -m "feat: stream built in agent text responses"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: adapter streaming, runtime delta events, command-layer immediate emit, text accumulation, tool-call chunk accumulation, bounded streaming buffers, and validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: OpenAI Responses streaming is not implemented; default adapter fallback preserves existing path.
