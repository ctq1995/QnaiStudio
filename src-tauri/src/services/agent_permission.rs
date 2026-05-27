use crate::error::{AppError, Result};
use crate::services::agent_session::AgentSession;
use crate::services::agent_tool_registry::{find_tool, ToolExecutionPolicy};

pub fn requires_approval(tool_name: &str) -> bool {
    matches!(
        find_tool(tool_name).map(|entry| entry.policy),
        Some(ToolExecutionPolicy::RequireApproval)
    )
}

pub fn apply_permission_response(session: &mut AgentSession, approved: bool) -> Result<()> {
    let pending = session
        .pending_permission
        .take()
        .ok_or_else(|| AppError::Unknown("当前会话没有待处理的权限请求".to_string()))?;

    if !approved {
        session.history.push(serde_json::json!({
            "role": "tool",
            "toolName": pending.tool_name,
            "toolUseId": pending.tool_use_id,
            "output": "permission denied",
        }));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{apply_permission_response, requires_approval};
    use crate::services::agent_session::{AgentSession, PendingToolCall};
    use crate::services::built_in_agent_session::BuiltInAgentSession;

    fn test_session() -> AgentSession {
        AgentSession::new(
            "session-1".to_string(),
            crate::services::agent_profiles::AgentProfileId::BuiltInCode,
            Some(PathBuf::from(".")),
        )
    }

    fn test_builtin_session() -> BuiltInAgentSession {
        BuiltInAgentSession {
            agent_session: test_session(),
            provider_id: "provider".to_string(),
            provider_kind: "openai".to_string(),
            api_key: None,
            base_url: None,
            model: "model".to_string(),
        }
    }

    #[test]
    fn registry_drives_approval_requirements() {
        assert!(requires_approval("bash"));
        assert!(!requires_approval("read_file"));
        assert!(!requires_approval("git_status"));
        assert!(!requires_approval("unknown"));
    }

    #[test]
    fn deny_permission_records_tool_output() {
        let mut session = test_session();
        session.pending_permission = Some(PendingToolCall {
            tool_use_id: "tool-1".to_string(),
            tool_name: "bash".to_string(),
            input: serde_json::json!({"command": "pwd"}),
        });

        apply_permission_response(&mut session, false).expect("permission response should apply");

        let entry = session.history.last().expect("history entry should exist");
        assert_eq!(entry.get("role").and_then(|value| value.as_str()), Some("tool"));
        assert_eq!(entry.get("toolName").and_then(|value| value.as_str()), Some("bash"));
        assert_eq!(entry.get("output").and_then(|value| value.as_str()), Some("permission denied"));
        assert!(session.pending_permission.is_none());
    }

    #[test]
    fn built_in_session_can_reuse_generic_permission_logic() {
        let mut session = test_builtin_session();
        *session.pending_permission_mut() = Some(PendingToolCall {
            tool_use_id: "tool-2".to_string(),
            tool_name: "bash".to_string(),
            input: serde_json::json!({"command": "pwd"}),
        });

        apply_permission_response(&mut session.agent_session, false)
            .expect("built-in permission response should apply");

        let tool_entries: Vec<_> = session
            .history()
            .iter()
            .filter(|entry| entry.get("role").and_then(|value| value.as_str()) == Some("tool"))
            .collect();
        assert_eq!(tool_entries.len(), 1);
        let entry = tool_entries[0];
        assert_eq!(entry.get("toolUseId").and_then(|value| value.as_str()), Some("tool-2"));
        assert_eq!(entry.get("toolName").and_then(|value| value.as_str()), Some("bash"));
        assert_eq!(entry.get("output").and_then(|value| value.as_str()), Some("permission denied"));
        assert!(session.pending_permission().is_none());
    }
}
