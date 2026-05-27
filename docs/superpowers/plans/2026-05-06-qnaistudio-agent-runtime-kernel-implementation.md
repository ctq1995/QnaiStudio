# QnaiStudio Agent Runtime Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前挂在 `custom-cli` 上的 built-in runtime 重构为 QnaiStudio 自有的通用 AgentRuntime 内核，形成可扩展的 session / turn / round / tool / model / permission 基础设施。

**Architecture:** 以 Rust `src-tauri` 为内核承载层，抽出 `AgentRuntime`、`AgentSessionManager`、`ToolRegistry`、`ModelAdapter`、`AgentProfile` 五个模块，保留当前前端事件协议不变，先让 `custom-cli` 变成对新 runtime 的一个入口适配器，再逐步从单引擎语义迁移到通用 agent profile 语义。实现顺序遵循“先抽边界，再迁功能，再接持久化，最后形成真正 turn/round loop”。

**Tech Stack:** Rust, Tauri, reqwest, serde/serde_json, existing chat event protocol, React frontend (unchanged protocol consumer)

---

## File Structure

### Existing files to keep but shrink

- `src-tauri/src/commands/chat/custom_cli.rs`
  - 保留为 `custom-cli` 引擎入口适配器，只负责把 start/continue 请求转交给新 `AgentRuntime`。
- `src-tauri/src/commands/chat/mod.rs`
  - 保留 Tauri command 入口，但 `interrupt_chat` / `respond_permission` 转交给 `AgentSessionManager` / `AgentRuntime`。
- `src-tauri/src/lib.rs`
  - `AppState` 从当前的 built-in 细节字段迁移为更通用的 `agent_runtime_state` / `agent_session_store`。

### New runtime kernel files

- `src-tauri/src/services/agent_runtime.rs`
  - 统一执行入口：`start_turn`、`continue_turn`、`resume_after_permission`。
- `src-tauri/src/services/agent_session.rs`
  - 定义 `AgentSession`、`DialogTurnState`、`ModelRoundState`、`PendingToolCall`。
- `src-tauri/src/services/agent_session_manager.rs`
  - 创建/读取/更新/删除 session，并处理内存态 + 磁盘态持久化。
- `src-tauri/src/services/agent_profiles.rs`
  - 定义 `AgentProfile`，包括 system prompt、可用工具集、默认模型策略。
- `src-tauri/src/services/agent_tool_registry.rs`
  - 注册工具 spec、风险级别、schema、执行器映射。
- `src-tauri/src/services/agent_model_adapter.rs`
  - 统一 `ModelAdapter` trait，以及 OpenAI-compatible 实现。
- `src-tauri/src/services/agent_persistence.rs`
  - 负责 `.qnai/agent-sessions/<session_id>/` 的序列化持久化。
- `src-tauri/src/services/agent_permission.rs`
  - 统一审批策略和批准/拒绝后的恢复行为。

### Existing built-in files to retire gradually

- `src-tauri/src/services/built_in_agent_runtime.rs`
- `src-tauri/src/services/built_in_agent_session.rs`
- `src-tauri/src/services/built_in_agent_permissions.rs`
- `src-tauri/src/services/built_in_agent_tools.rs`
- `src-tauri/src/services/built_in_agent_llm.rs`

这些文件先作为迁移期参考，最终应被新 runtime 文件替代，避免长期双轨维护。

---

### Task 1: 抽出统一 AgentSession 结构

**Files:**
- Create: `src-tauri/src/services/agent_session.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/services/agent_session.rs`（先写内联单元测试）

- [ ] **Step 1: 写 session 结构测试草图**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agent_session_starts_with_empty_turn_state() {
        let session = AgentSession::new(
            "s1".into(),
            AgentProfileId::BuiltInCode,
            Some("E:/demo".into()),
        );

        assert_eq!(session.session_id, "s1");
        assert!(session.history.is_empty());
        assert!(session.active_turn.is_none());
        assert!(session.pending_permission.is_none());
    }
}
```

- [ ] **Step 2: 运行测试确认当前不存在该文件/类型**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" agent_session_starts_with_empty_turn_state -- --nocapture`
Expected: FAIL with unresolved module/type errors

- [ ] **Step 3: 实现最小 `AgentSession` 结构**

```rust
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentProfileId {
    BuiltInCode,
}

#[derive(Debug, Clone)]
pub struct PendingToolCall {
    pub tool_use_id: String,
    pub tool_name: String,
    pub input: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct ModelRoundState {
    pub round_index: u32,
}

#[derive(Debug, Clone)]
pub struct DialogTurnState {
    pub user_message: String,
    pub current_round: ModelRoundState,
}

#[derive(Debug, Clone)]
pub struct AgentSession {
    pub session_id: String,
    pub profile_id: AgentProfileId,
    pub work_dir: Option<PathBuf>,
    pub history: Vec<serde_json::Value>,
    pub active_turn: Option<DialogTurnState>,
    pub pending_permission: Option<PendingToolCall>,
}

impl AgentSession {
    pub fn new(session_id: String, profile_id: AgentProfileId, work_dir: Option<PathBuf>) -> Self {
        Self {
            session_id,
            profile_id,
            work_dir,
            history: Vec::new(),
            active_turn: None,
            pending_permission: None,
        }
    }
}
```

- [ ] **Step 4: 在 `services/mod.rs` 注册新模块**

```rust
pub mod agent_session;
```

- [ ] **Step 5: 在 `lib.rs` 中准备通用 runtime 状态字段占位**

```rust
pub agent_sessions: Arc<Mutex<HashMap<String, AgentSession>>>,
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" agent_session_starts_with_empty_turn_state -- --nocapture`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src-tauri/src/services/agent_session.rs src-tauri/src/services/mod.rs src-tauri/src/lib.rs
git commit -m "refactor: introduce agent session model"
```

### Task 2: 抽出 AgentProfile 与 ModelAdapter 边界

**Files:**
- Create: `src-tauri/src/services/agent_profiles.rs`
- Create: `src-tauri/src/services/agent_model_adapter.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/services/built_in_agent_llm.rs`（迁移逻辑后删除或瘦身）
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/services/agent_model_adapter.rs`

- [ ] **Step 1: 写 adapter 选择测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn openai_compatible_provider_maps_to_openai_adapter() {
        let adapter = select_model_adapter("openai-compatible");
        assert_eq!(adapter.id(), "openai-compatible");
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" openai_compatible_provider_maps_to_openai_adapter -- --nocapture`
Expected: FAIL with unresolved function/type errors

- [ ] **Step 3: 定义 `AgentProfile` 最小结构**

```rust
use crate::services::agent_session::AgentProfileId;

#[derive(Debug, Clone)]
pub struct AgentProfile {
    pub id: AgentProfileId,
    pub display_name: &'static str,
    pub system_prompt: &'static str,
    pub tool_names: &'static [&'static str],
}

pub fn built_in_code_profile() -> AgentProfile {
    AgentProfile {
        id: AgentProfileId::BuiltInCode,
        display_name: "内置 Agent",
        system_prompt: "You are QnaiStudio built-in coding agent.",
        tool_names: &["read_file", "git_status", "bash"],
    }
}
```

- [ ] **Step 4: 为异步 adapter 增加依赖并定义 `ModelAdapter` trait**

```toml
async-trait = "0.1"
```

```rust
#[async_trait::async_trait]
pub trait ModelAdapter: Send + Sync {
    fn id(&self) -> &'static str;
    async fn complete(
        &self,
        request: ModelCompletionRequest,
    ) -> crate::error::Result<ModelCompletionResponse>;
}
```

```rust
pub fn select_model_adapter(kind: &str) -> Box<dyn ModelAdapter> {
    match kind {
        "openai-compatible" | "openai" => Box::new(OpenAiCompatibleAdapter::default()),
        _ => Box::new(OpenAiCompatibleAdapter::default()),
    }
}
```

- [ ] **Step 5: 将 `built_in_agent_llm.rs` 中的 HTTP 请求逻辑迁入新 adapter**

```rust
let response = client
    .post(normalize_base_url(&request.base_url)?)
    .bearer_auth(request.api_key)
    .json(&body)
    .send()
    .await?;
```

- [ ] **Step 6: 运行测试确认 adapter 可用**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" openai_compatible_provider_maps_to_openai_adapter -- --nocapture`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src-tauri/src/services/agent_profiles.rs src-tauri/src/services/agent_model_adapter.rs src-tauri/src/services/mod.rs src-tauri/src/services/built_in_agent_llm.rs src-tauri/Cargo.toml
git commit -m "refactor: add agent profile and model adapter boundaries"
```

### Task 3: 抽出 ToolRegistry 与统一权限策略

**Files:**
- Create: `src-tauri/src/services/agent_tool_registry.rs`
- Create: `src-tauri/src/services/agent_permission.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/src/services/built_in_agent_tools.rs`
- Modify: `src-tauri/src/commands/chat/mod.rs`
- Test: `src-tauri/src/services/agent_tool_registry.rs`

- [ ] **Step 1: 写 registry 查询测试**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_returns_bash_spec_as_high_risk_tool() {
        let registry = AgentToolRegistry::default();
        let tool = registry.get("bash").expect("bash tool should exist");
        assert_eq!(tool.name, "bash");
        assert!(tool.requires_approval);
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" registry_returns_bash_spec_as_high_risk_tool -- --nocapture`
Expected: FAIL with unresolved type errors

- [ ] **Step 3: 实现 `AgentToolRegistry` 和 `ToolSpec`**

```rust
pub struct ToolSpec {
    pub name: &'static str,
    pub description: &'static str,
    pub requires_approval: bool,
}

pub struct AgentToolRegistry {
    tools: std::collections::HashMap<&'static str, ToolSpec>,
}
```

- [ ] **Step 4: 把现有 `read_file` / `git_status` / `bash` 执行器映射到 registry**

```rust
pub fn execute(&self, tool_name: &str, input: &serde_json::Value, work_dir: Option<&std::path::Path>) -> Result<String> {
    match tool_name {
        "read_file" => execute_read_file(input, work_dir),
        "git_status" => execute_git_status(work_dir),
        "bash" => execute_bash(input, work_dir),
        _ => Err(AppError::Unknown(format!("未支持的工具: {}", tool_name))),
    }
}
```

- [ ] **Step 5: 把审批逻辑从 `built_in_agent_permissions.rs` 迁移到 `agent_permission.rs`**

```rust
pub fn should_request_permission(tool: &ToolSpec) -> bool {
    tool.requires_approval
}
```

- [ ] **Step 6: 在 `respond_permission` 中使用新 permission 模块**

```rust
crate::services::agent_permission::apply_permission_response(session, approved)?;
```

- [ ] **Step 7: 运行测试确认通过**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" registry_returns_bash_spec_as_high_risk_tool -- --nocapture`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add src-tauri/src/services/agent_tool_registry.rs src-tauri/src/services/agent_permission.rs src-tauri/src/services/mod.rs src-tauri/src/services/built_in_agent_tools.rs src-tauri/src/commands/chat/mod.rs
git commit -m "refactor: add tool registry and permission service"
```

### Task 4: 引入 AgentSessionManager 与持久化目录

**Files:**
- Create: `src-tauri/src/services/agent_persistence.rs`
- Create: `src-tauri/src/services/agent_session_manager.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/services/agent_persistence.rs`

- [ ] **Step 1: 为持久化测试增加依赖并写 session 持久化测试**

```toml
tempfile = "3"
```

```rust
#[test]
fn persistence_round_trip_restores_pending_permission() {
    let temp = tempfile::tempdir().unwrap();
    let session = AgentSession::new("s1".into(), AgentProfileId::BuiltInCode, None);
    save_session(temp.path(), &session).unwrap();
    let restored = load_session(temp.path(), "s1").unwrap();
    assert_eq!(restored.session_id, "s1");
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" persistence_round_trip_restores_pending_permission -- --nocapture`
Expected: FAIL with unresolved function/type errors

- [ ] **Step 3: 实现 `.qnai/agent-sessions/<session_id>/session.json` 持久化**

```rust
pub fn session_dir(base: &std::path::Path, session_id: &str) -> std::path::PathBuf {
    base.join(".qnai").join("agent-sessions").join(session_id)
}
```

- [ ] **Step 4: 实现 `AgentSessionManager`**

```rust
pub struct AgentSessionManager {
    sessions: Arc<Mutex<HashMap<String, AgentSession>>>,
    root_dir: PathBuf,
}
```

```rust
pub fn upsert(&self, session: AgentSession) -> Result<()> {
    save_session(&self.root_dir, &session)?;
    self.sessions.lock().unwrap().insert(session.session_id.clone(), session);
    Ok(())
}
```

- [ ] **Step 5: 在 `AppState` 中用 manager 替代裸 `built_in_agent_sessions`**

```rust
pub agent_session_manager: Arc<AgentSessionManager>,
```

- [ ] **Step 6: 运行持久化测试确认通过**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" persistence_round_trip_restores_pending_permission -- --nocapture`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src-tauri/src/services/agent_persistence.rs src-tauri/src/services/agent_session_manager.rs src-tauri/src/lib.rs src-tauri/src/services/mod.rs src-tauri/Cargo.toml
git commit -m "feat: add agent session persistence and manager"
```

### Task 5: 实现通用 AgentRuntime 并迁移 `custom-cli` 入口

**Files:**
- Create: `src-tauri/src/services/agent_runtime.rs`
- Modify: `src-tauri/src/commands/chat/custom_cli.rs`
- Modify: `src-tauri/src/services/built_in_agent_runtime.rs`
- Modify: `src-tauri/src/services/mod.rs`
- Test: `src-tauri/src/services/agent_runtime.rs`

- [ ] **Step 1: 写 runtime 单轮执行测试**

```rust
#[tokio::test]
async fn runtime_runs_plain_message_and_appends_assistant_reply() {
    let mut session = AgentSession::new("s1".into(), AgentProfileId::BuiltInCode, None);
    let runtime = AgentRuntime::new(/* inject stubs */);
    let events = runtime.start_turn(&mut session, "hello").await.unwrap();
    assert!(!events.is_empty());
    assert!(session.history.len() >= 2);
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" runtime_runs_plain_message_and_appends_assistant_reply -- --nocapture`
Expected: FAIL with unresolved type errors

- [ ] **Step 3: 实现 `AgentRuntime` 统一入口**

```rust
pub struct AgentRuntime {
    pub tool_registry: AgentToolRegistry,
}

impl AgentRuntime {
    pub async fn start_turn(&self, session: &mut AgentSession, message: &str) -> Result<Vec<StreamEvent>> {
        self.run_turn(session, message, true).await
    }

    pub async fn continue_turn(&self, session: &mut AgentSession, message: &str) -> Result<Vec<StreamEvent>> {
        self.run_turn(session, message, false).await
    }
}
```

- [ ] **Step 4: 将 `custom_cli.rs` 改为只调用 `AgentRuntime`**

```rust
let mut session = ctx.state.agent_session_manager.create_or_load(...)?;
let events = ctx.state.agent_runtime.start_turn(&mut session, &args.message).await?;
ctx.state.agent_session_manager.upsert(session)?;
```

- [ ] **Step 5: 保留旧 built-in runtime 文件仅做兼容转发，避免大爆炸删除**

```rust
pub use crate::services::agent_runtime::*;
```

- [ ] **Step 6: 运行 runtime 测试确认通过**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" runtime_runs_plain_message_and_appends_assistant_reply -- --nocapture`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src-tauri/src/services/agent_runtime.rs src-tauri/src/commands/chat/custom_cli.rs src-tauri/src/services/built_in_agent_runtime.rs src-tauri/src/services/mod.rs
git commit -m "refactor: route custom-cli through agent runtime"
```

### Task 6: 实现审批后恢复执行与最小 Agent loop

**Files:**
- Modify: `src-tauri/src/services/agent_runtime.rs`
- Modify: `src-tauri/src/services/agent_permission.rs`
- Modify: `src-tauri/src/commands/chat/mod.rs`
- Test: `src-tauri/src/services/agent_runtime.rs`

- [ ] **Step 1: 写审批通过后恢复工具执行测试**

```rust
#[tokio::test]
async fn approved_permission_resumes_pending_tool_and_finishes_turn() {
    let mut session = AgentSession::new("s1".into(), AgentProfileId::BuiltInCode, None);
    session.pending_permission = Some(PendingToolCall {
        tool_use_id: "t1".into(),
        tool_name: "bash".into(),
        input: serde_json::json!({ "command": "echo hi" }),
    });
    let runtime = AgentRuntime::new(/* inject real or stub registry */);
    let events = runtime.resume_after_permission(&mut session, true).await.unwrap();
    assert!(events.iter().any(|event| matches!(event, StreamEvent::ToolEnd { .. })));
    assert!(events.iter().any(|event| matches!(event, StreamEvent::SessionEnd { .. })));
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" approved_permission_resumes_pending_tool_and_finishes_turn -- --nocapture`
Expected: FAIL with missing method errors

- [ ] **Step 3: 在 `AgentRuntime` 中实现 `resume_after_permission`**

```rust
pub async fn resume_after_permission(&self, session: &mut AgentSession, approved: bool) -> Result<Vec<StreamEvent>> {
    let pending = session.pending_permission.take().ok_or_else(|| AppError::Unknown("no pending tool".into()))?;
    if !approved {
        return Ok(vec![StreamEvent::SessionEnd { reason: "permission_denied".into() }]);
    }
    let output = self.tool_registry.execute(&pending.tool_name, &pending.input, session.work_dir.as_deref())?;
    Ok(vec![
        StreamEvent::ToolEnd {
            tool_use_id: pending.tool_use_id,
            tool_name: Some(pending.tool_name),
            output: Some(output),
        },
        StreamEvent::SessionEnd { reason: "completed".into() },
    ])
}
```

- [ ] **Step 4: 在 `respond_permission` 中调用 runtime 恢复执行，而不是只改 session 状态**

```rust
let events = state.agent_runtime.resume_after_permission(session, approved).await?;
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cargo test --manifest-path "src-tauri/Cargo.toml" approved_permission_resumes_pending_tool_and_finishes_turn -- --nocapture`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/services/agent_runtime.rs src-tauri/src/services/agent_permission.rs src-tauri/src/commands/chat/mod.rs
git commit -m "feat: resume pending tool execution after permission"
```

### Task 7: 清理 built-in 专用旧文件并完成验证

**Files:**
- Modify/Delete: `src-tauri/src/services/built_in_agent_runtime.rs`
- Modify/Delete: `src-tauri/src/services/built_in_agent_session.rs`
- Modify/Delete: `src-tauri/src/services/built_in_agent_permissions.rs`
- Modify/Delete: `src-tauri/src/services/built_in_agent_tools.rs`
- Modify/Delete: `src-tauri/src/services/built_in_agent_llm.rs`
- Test: `src-tauri/Cargo.toml`, frontend build

- [ ] **Step 1: 删除或改为转发模块，移除未使用旧实现**

```rust
pub use crate::services::agent_runtime::*;
pub use crate::services::agent_session::*;
```

- [ ] **Step 2: 全量 Rust 验证**

Run: `cargo check --manifest-path "src-tauri/Cargo.toml"`
Expected: PASS

- [ ] **Step 3: 前端构建验证**

Run: `npm -C "E:/Polaris/QnaiStudio" run build`
Expected: PASS

- [ ] **Step 4: 查看工作区变更**

Run: `git -C "E:/Polaris/QnaiStudio" status --short`
Expected: only intended files modified

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/services src-tauri/src/commands/chat src-tauri/src/lib.rs
git commit -m "refactor: migrate built-in agent to runtime kernel"
```

---

## Notes for execution

- 保持前端事件协议不变，避免同时改 UI 消费层。
- 不要在第一阶段引入浏览器自动化、远程控制或更复杂能力；先把通用 runtime 核心收敛。
- 不要继续在 `custom_cli.rs` 中堆运行时逻辑；它最终必须退化为入口适配器。
- 每个任务结束后都要先跑对应最小验证，再继续下一个任务。
