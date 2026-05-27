use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub use crate::services::agent_profiles::AgentProfileId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingToolCall {
    pub tool_use_id: String,
    pub tool_name: String,
    pub input: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRoundState {
    pub round_index: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialogTurnState {
    pub user_message: String,
    pub current_round: ModelRoundState,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentMode {
    Agentic,
    Plan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: String,
    pub content: String,
    pub status: String, // "pending", "in_progress", "completed"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSession {
    pub session_id: String,
    pub profile_id: AgentProfileId,
    pub work_dir: Option<PathBuf>,
    pub history: Vec<serde_json::Value>,
    pub active_turn: Option<DialogTurnState>,
    pub pending_permission: Option<PendingToolCall>,
    // Plan Mode 状态
    pub mode: AgentMode,
    pub plan: Option<String>,
    pub plan_confirmed: bool,
    // TodoWrite 状态
    pub todos: Vec<TodoItem>,
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
            mode: AgentMode::Agentic,
            plan: None,
            plan_confirmed: false,
            todos: Vec::new(),
        }
    }

    pub fn enter_plan_mode(&mut self) {
        self.mode = AgentMode::Plan;
        self.plan = None;
        self.plan_confirmed = false;
    }

    pub fn set_plan(&mut self, plan: String) {
        self.plan = Some(plan);
        self.plan_confirmed = false;
    }

    pub fn confirm_plan(&mut self) {
        self.plan_confirmed = true;
    }

    pub fn exit_plan_mode(&mut self) {
        self.mode = AgentMode::Agentic;
    }

    pub fn update_todos(&mut self, todos: Vec<TodoItem>) {
        self.todos = todos;
    }
}

#[cfg(test)]
mod tests {
    use super::{AgentMode, AgentProfileId, AgentSession, TodoItem};

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
        assert_eq!(session.mode, AgentMode::Agentic);
        assert!(session.plan.is_none());
        assert!(!session.plan_confirmed);
        assert!(session.todos.is_empty());
    }

    #[test]
    fn plan_mode_transitions() {
        let mut session = AgentSession::new(
            "s1".into(),
            AgentProfileId::BuiltInCode,
            None,
        );

        // 进入计划模式
        session.enter_plan_mode();
        assert_eq!(session.mode, AgentMode::Plan);
        assert!(session.plan.is_none());

        // 设置计划
        session.set_plan("1. 分析代码\n2. 修复bug\n3. 验证".into());
        assert!(session.plan.is_some());
        assert!(!session.plan_confirmed);

        // 确认计划
        session.confirm_plan();
        assert!(session.plan_confirmed);

        // 退出计划模式
        session.exit_plan_mode();
        assert_eq!(session.mode, AgentMode::Agentic);
    }

    #[test]
    fn todo_write_updates_todos() {
        let mut session = AgentSession::new(
            "s1".into(),
            AgentProfileId::BuiltInCode,
            None,
        );

        let todos = vec![
            TodoItem { id: "1".into(), content: "分析问题".into(), status: "completed".into() },
            TodoItem { id: "2".into(), content: "定位代码".into(), status: "in_progress".into() },
            TodoItem { id: "3".into(), content: "修复问题".into(), status: "pending".into() },
        ];

        session.update_todos(todos.clone());
        assert_eq!(session.todos.len(), 3);
        assert_eq!(session.todos[0].status, "completed");
        assert_eq!(session.todos[1].status, "in_progress");
        assert_eq!(session.todos[2].status, "pending");
    }
}
