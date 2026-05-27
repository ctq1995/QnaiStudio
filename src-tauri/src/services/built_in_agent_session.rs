use std::path::Path;

use crate::services::agent_session::{AgentSession, PendingToolCall};

pub type PendingPermission = PendingToolCall;

#[derive(Debug, Clone)]
pub struct BuiltInAgentSession {
    pub agent_session: AgentSession,
    pub provider_id: String,
    pub provider_kind: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: String,
}

impl BuiltInAgentSession {
    pub fn session_id(&self) -> &str {
        &self.agent_session.session_id
    }

    pub fn work_dir(&self) -> Option<&Path> {
        self.agent_session.work_dir.as_deref()
    }

    pub fn history(&self) -> &Vec<serde_json::Value> {
        &self.agent_session.history
    }

    pub fn history_mut(&mut self) -> &mut Vec<serde_json::Value> {
        &mut self.agent_session.history
    }

    pub fn pending_permission(&self) -> Option<&PendingPermission> {
        self.agent_session.pending_permission.as_ref()
    }

    pub fn pending_permission_mut(&mut self) -> &mut Option<PendingPermission> {
        &mut self.agent_session.pending_permission
    }

    pub fn round_count(&self) -> u32 {
        self.agent_session
            .active_turn
            .as_ref()
            .map(|turn| turn.current_round.round_index)
            .unwrap_or(0)
    }

    pub fn increment_round_count(&mut self) {
        match self.agent_session.active_turn.as_mut() {
            Some(turn) => {
                turn.current_round.round_index += 1;
            }
            None => {
                self.agent_session.active_turn = Some(crate::services::agent_session::DialogTurnState {
                    user_message: String::new(),
                    current_round: crate::services::agent_session::ModelRoundState { round_index: 1 },
                });
            }
        }
    }
}
