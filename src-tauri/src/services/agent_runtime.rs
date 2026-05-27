use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use crate::error::{AppError, Result};
use crate::models::config::Config;
use crate::models::events::StreamEvent;
use crate::services::agent_session::AgentSession;
use crate::services::agent_session_manager::AgentSessionManager;
use crate::services::agent_tool_registry::execute_tool;
use crate::services::built_in_agent_runtime::{
    continue_message_events, create_session_from_config, resume_pending_tool_events, start_message_events,
};
use crate::services::built_in_agent_session::BuiltInAgentSession;

#[derive(Clone)]
pub struct AgentRuntime {
    agent_sessions: Arc<Mutex<HashMap<String, AgentSession>>>,
    built_in_sessions: Arc<Mutex<HashMap<String, BuiltInAgentSession>>>,
    session_manager: AgentSessionManager,
}

impl AgentRuntime {
    pub fn new(
        agent_sessions: Arc<Mutex<HashMap<String, AgentSession>>>,
        built_in_sessions: Arc<Mutex<HashMap<String, BuiltInAgentSession>>>,
        session_manager: AgentSessionManager,
    ) -> Self {
        Self {
            agent_sessions,
            built_in_sessions,
            session_manager,
        }
    }

    pub fn create_built_in_session(session_id: String, config: &Config) -> Result<BuiltInAgentSession> {
        create_session_from_config(session_id, config)
    }

    pub async fn start_built_in_session(
        &self,
        session_id: String,
        config: &Config,
        message: &str,
    ) -> Result<Vec<StreamEvent>> {
        let mut session = Self::create_built_in_session(session_id.clone(), config)?;
        let events = start_message_events(&mut session, message).await;
        self.store_built_in_session(session_id, session)?;
        Ok(events)
    }

    pub async fn continue_built_in_session(&self, session_id: &str, message: &str) -> Result<Vec<StreamEvent>> {
        let mut session = self.take_built_in_session(session_id)?;
        let events = continue_message_events(&mut session, message).await;
        self.store_built_in_session(session_id.to_string(), session)?;
        Ok(events)
    }

    pub async fn respond_built_in_permission(&self, session_id: &str, approved: bool) -> Result<Vec<StreamEvent>> {
        let mut session = self.take_built_in_session(session_id)?;
        let pending = session
            .pending_permission()
            .cloned()
            .ok_or_else(|| AppError::Unknown("当前会话没有待处理的权限请求".to_string()))?;

        if approved {
            let output = execute_tool(&pending.tool_name, &pending.input, session.work_dir())?;
            let events = resume_pending_tool_events(&mut session, &pending, output).await;
            self.store_built_in_session(session_id.to_string(), session)?;
            return Ok(events);
        }

        crate::services::agent_permission::apply_permission_response(&mut session.agent_session, false)?;
        let events = vec![
            StreamEvent::Error {
                error: "用户拒绝了内置 Agent 的工具调用".to_string(),
            },
            StreamEvent::SessionEnd {
                reason: "permission_denied".to_string(),
            },
        ];
        self.store_built_in_session(session_id.to_string(), session)?;
        Ok(events)
    }

    fn take_built_in_session(&self, session_id: &str) -> Result<BuiltInAgentSession> {
        let mut guard = self
            .built_in_sessions
            .lock()
            .map_err(|error| AppError::Unknown(error.to_string()))?;
        guard
            .remove(session_id)
            .ok_or_else(|| AppError::SessionNotFound(session_id.to_string()))
    }

    fn store_built_in_session(&self, session_id: String, session: BuiltInAgentSession) -> Result<()> {
        let agent_session = session.agent_session.clone();

        self.agent_sessions
            .lock()
            .map_err(|error| AppError::Unknown(error.to_string()))?
            .insert(session_id.clone(), agent_session.clone());

        self.session_manager.save_session(&agent_session)?;

        self.built_in_sessions
            .lock()
            .map_err(|error| AppError::Unknown(error.to_string()))?
            .insert(session_id, session);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::AgentRuntime;
    use crate::models::config::{Config, CustomCliConfig, ModelProviderConfig};
    use crate::services::agent_persistence::AgentPersistence;
    use crate::services::agent_session::AgentProfileId;
    use crate::services::agent_session_manager::AgentSessionManager;
    use crate::services::built_in_agent_runtime::resume_pending_tool_events;
    use crate::services::built_in_agent_session::BuiltInAgentSession;

    fn test_config() -> Config {
        let mut config = Config::default();
        config.custom_cli = CustomCliConfig {
            provider_id: Some("provider-1".to_string()),
            model: Some("test-model".to_string()),
            ..CustomCliConfig::default()
        };
        config.providers = vec![ModelProviderConfig {
            id: "provider-1".to_string(),
            kind: "openai-chat".to_string(),
            name: "Provider 1".to_string(),
            api_key: Some("key".to_string()),
            base_url: Some("https://example.com".to_string()),
        }];
        config.work_dir = Some(std::env::temp_dir());
        config
    }

    fn test_runtime() -> (AgentRuntime, Arc<Mutex<HashMap<String, crate::services::agent_session::AgentSession>>>, Arc<Mutex<HashMap<String, crate::services::built_in_agent_session::BuiltInAgentSession>>>, AgentSessionManager, std::path::PathBuf) {
        let agent_sessions = Arc::new(Mutex::new(HashMap::new()));
        let built_in_sessions = Arc::new(Mutex::new(HashMap::new()));
        let base_dir = std::env::temp_dir().join(format!(
            "qnai-agent-runtime-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before unix epoch")
                .as_nanos()
        ));
        let manager = AgentSessionManager::new(AgentPersistence::new(base_dir.clone()));
        let runtime = AgentRuntime::new(agent_sessions.clone(), built_in_sessions.clone(), manager.clone());
        (runtime, agent_sessions, built_in_sessions, manager, base_dir)
    }

    #[tokio::test]
    async fn resume_pending_tool_events_keeps_tool_message_shape() {
        let mut session = BuiltInAgentSession {
            agent_session: crate::services::agent_session::AgentSession::new(
                "session-loop".to_string(),
                AgentProfileId::BuiltInCode,
                Some(std::env::temp_dir()),
            ),
            provider_id: "provider-1".to_string(),
            provider_kind: "openai-chat".to_string(),
            api_key: Some("key".to_string()),
            base_url: Some("https://example.com".to_string()),
            model: "test-model".to_string(),
        };
        *session.pending_permission_mut() = Some(crate::services::agent_session::PendingToolCall {
            tool_use_id: "call-1".to_string(),
            tool_name: "bash".to_string(),
            input: serde_json::json!({"command": "echo hi"}),
        });
        let pending = session.pending_permission().cloned().expect("pending permission should exist");

        let events = resume_pending_tool_events(&mut session, &pending, "approved".to_string()).await;

        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::ToolEnd { .. })));
        let tool_entries: Vec<_> = session
            .history()
            .iter()
            .filter(|entry| {
                entry.get("role").and_then(|value| value.as_str()) == Some("tool")
                    && entry.get("tool_call_id").and_then(|value| value.as_str()) == Some("call-1")
            })
            .collect();
        assert_eq!(tool_entries.len(), 1);
        let tool_entry = tool_entries[0];
        assert_eq!(tool_entry.get("content").and_then(|value| value.as_str()), Some("approved"));
        assert!(tool_entry.get("tool_calls").map(|value| value.is_null()).unwrap_or(true));
    }

    #[tokio::test]
    async fn starts_built_in_session_via_runtime_boundary() {
        let (runtime, agent_sessions, built_in_sessions, manager, base_dir) = test_runtime();

        let events = runtime
            .start_built_in_session("session-1".to_string(), &test_config(), "/git-status")
            .await
            .expect("runtime should start built-in session");

        let built_in_session = built_in_sessions
            .lock()
            .expect("lock built-in sessions")
            .get("session-1")
            .cloned()
            .expect("built-in session stored");
        let agent_session = agent_sessions
            .lock()
            .expect("lock agent sessions")
            .get("session-1")
            .cloned()
            .expect("agent session stored");
        let persisted = manager
            .load_session("session-1")
            .expect("load persisted session")
            .expect("persisted session exists");

        assert_eq!(built_in_session.session_id(), "session-1");
        assert_eq!(agent_session.session_id, "session-1");
        assert_eq!(agent_session.profile_id, AgentProfileId::BuiltInCode);
        assert_eq!(persisted.session_id, "session-1");
        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::ToolStart { .. })));
        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::SessionEnd { .. })));

        let _ = std::fs::remove_dir_all(base_dir);
    }

    #[tokio::test]
    async fn continues_built_in_session_updates_memory_and_persistence() {
        let (runtime, agent_sessions, built_in_sessions, manager, base_dir) = test_runtime();
        runtime
            .start_built_in_session("session-2".to_string(), &test_config(), "/git-status")
            .await
            .expect("start built-in session");

        let events = runtime
            .continue_built_in_session("session-2", "/git-status")
            .await
            .expect("continue built-in session");

        let built_in_round_count = built_in_sessions
            .lock()
            .expect("lock built-in sessions")
            .get("session-2")
            .map(|session| session.round_count())
            .expect("built-in session stored after continue");
        let persisted = manager
            .load_session("session-2")
            .expect("load persisted session")
            .expect("persisted session exists");
        let memory_session = agent_sessions
            .lock()
            .expect("lock agent sessions")
            .get("session-2")
            .cloned()
            .expect("agent session stored after continue");

        assert_eq!(built_in_round_count, 2);
        assert_eq!(memory_session.active_turn.as_ref().map(|turn| turn.current_round.round_index), Some(2));
        assert_eq!(persisted.active_turn.as_ref().map(|turn| turn.current_round.round_index), Some(2));
        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::SessionEnd { .. })));

        let _ = std::fs::remove_dir_all(base_dir);
    }

    #[tokio::test]
    async fn approved_permission_executes_pending_tool_and_persists_history() {
        let (runtime, agent_sessions, built_in_sessions, manager, base_dir) = test_runtime();
        runtime
            .start_built_in_session("session-3".to_string(), &test_config(), "/bash echo approved")
            .await
            .expect("start built-in session with approval");

        let start_session = built_in_sessions
            .lock()
            .expect("lock built-in sessions")
            .get("session-3")
            .cloned()
            .expect("built-in session exists after start");
        assert!(start_session.pending_permission().is_some());

        let events = runtime
            .respond_built_in_permission("session-3", true)
            .await
            .expect("approve permission should resume execution");

        let built_in_session = built_in_sessions
            .lock()
            .expect("lock built-in sessions")
            .get("session-3")
            .cloned()
            .expect("built-in session exists after approval");
        let memory_session = agent_sessions
            .lock()
            .expect("lock agent sessions")
            .get("session-3")
            .cloned()
            .expect("agent session stored after approval");
        let persisted = manager
            .load_session("session-3")
            .expect("load persisted session")
            .expect("persisted session exists");

        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::ToolEnd { .. })));
        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::SessionEnd { .. })));
        assert!(built_in_session.pending_permission().is_none());
        assert_eq!(built_in_session.round_count(), 1);
        assert_eq!(memory_session.active_turn.as_ref().map(|turn| turn.current_round.round_index), Some(1));
        assert_eq!(persisted.active_turn.as_ref().map(|turn| turn.current_round.round_index), Some(1));
        assert!(memory_session.history.iter().any(|entry| {
            entry.get("role").and_then(|value| value.as_str()) == Some("tool")
                && entry.get("tool_call_id").and_then(|value| value.as_str()).is_some()
        }));
        assert!(persisted.history.iter().any(|entry| {
            entry.get("role").and_then(|value| value.as_str()) == Some("tool")
                && entry
                    .get("content")
                    .and_then(|value| value.as_str())
                    .map(|text| text.contains("approved"))
                    .unwrap_or(false)
        }));

        let _ = std::fs::remove_dir_all(base_dir);
    }

    #[tokio::test]
    async fn denied_permission_records_denial_via_runtime_boundary() {
        let (runtime, agent_sessions, built_in_sessions, manager, base_dir) = test_runtime();
        runtime
            .start_built_in_session("session-4".to_string(), &test_config(), "/bash echo denied")
            .await
            .expect("start built-in session with approval");

        let events = runtime
            .respond_built_in_permission("session-4", false)
            .await
            .expect("deny permission should update session");

        let built_in_session = built_in_sessions
            .lock()
            .expect("lock built-in sessions")
            .get("session-4")
            .cloned()
            .expect("built-in session exists after denial");
        let memory_session = agent_sessions
            .lock()
            .expect("lock agent sessions")
            .get("session-4")
            .cloned()
            .expect("agent session stored after denial");
        let persisted = manager
            .load_session("session-4")
            .expect("load persisted session")
            .expect("persisted session exists");

        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::Error { .. })));
        assert!(events.iter().any(|event| matches!(event, crate::models::events::StreamEvent::SessionEnd { reason } if reason == "permission_denied")));
        assert!(built_in_session.pending_permission().is_none());
        let memory_tool_entries: Vec<_> = memory_session
            .history
            .iter()
            .filter(|entry| {
                entry.get("role").and_then(|value| value.as_str()) == Some("tool")
                    && entry.get("toolName").and_then(|value| value.as_str()) == Some("bash")
            })
            .collect();
        assert_eq!(memory_tool_entries.len(), 1);
        assert_eq!(memory_tool_entries[0].get("output").and_then(|value| value.as_str()), Some("permission denied"));

        let persisted_tool_entries: Vec<_> = persisted
            .history
            .iter()
            .filter(|entry| {
                entry.get("role").and_then(|value| value.as_str()) == Some("tool")
                    && entry.get("toolName").and_then(|value| value.as_str()) == Some("bash")
            })
            .collect();
        assert_eq!(persisted_tool_entries.len(), 1);
        assert_eq!(persisted_tool_entries[0].get("output").and_then(|value| value.as_str()), Some("permission denied"));

        let _ = std::fs::remove_dir_all(base_dir);
    }
}
