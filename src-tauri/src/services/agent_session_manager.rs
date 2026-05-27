use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::Result;

use super::agent_persistence::AgentPersistence;
use super::agent_session::AgentSession;

const PERSISTED_SESSION_VERSION: u32 = 1;

#[derive(Debug, Clone)]
pub struct AgentSessionManager {
    persistence: AgentPersistence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedAgentSession {
    version: u32,
    session: AgentSession,
}

impl AgentSessionManager {
    pub fn new(persistence: AgentPersistence) -> Self {
        Self { persistence }
    }

    pub fn from_work_dir(work_dir: &Path) -> Self {
        Self::new(AgentPersistence::from_work_dir(work_dir))
    }

    pub fn persistence(&self) -> &AgentPersistence {
        &self.persistence
    }

    pub fn session_exists(&self, session_id: &str) -> bool {
        self.persistence.session_exists(session_id)
    }

    pub fn save_session(&self, session: &AgentSession) -> Result<PathBuf> {
        self.persistence.ensure_base_dir()?;
        self.persistence.ensure_session_dir(&session.session_id)?;
        let file_path = self.persistence.session_file(&session.session_id);
        let payload = PersistedAgentSession {
            version: PERSISTED_SESSION_VERSION,
            session: session.clone(),
        };
        let content = serde_json::to_vec_pretty(&payload)?;
        fs::write(&file_path, content)?;
        Ok(file_path)
    }

    pub fn load_session(&self, session_id: &str) -> Result<Option<AgentSession>> {
        let file_path = self.persistence.session_file(session_id);
        if !file_path.exists() {
            return Ok(None);
        }

        let content = fs::read(&file_path)?;
        let payload: PersistedAgentSession = serde_json::from_slice(&content)?;
        Ok(Some(payload.session))
    }

    pub fn delete_session(&self, session_id: &str) -> Result<()> {
        self.persistence.delete_session_dir(session_id)
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use crate::services::agent_profiles::AgentProfileId;

    use super::AgentSessionManager;
    use super::super::agent_session::AgentSession;

    #[test]
    fn saves_and_loads_session_json() {
        let base_dir = std::env::temp_dir().join(format!(
            "qnai-agent-session-manager-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before unix epoch")
                .as_nanos()
        ));
        let manager = AgentSessionManager::new(super::super::agent_persistence::AgentPersistence::new(base_dir.clone()));
        let mut session = AgentSession::new(
            "session-1".into(),
            AgentProfileId::BuiltInCode,
            Some(PathBuf::from("E:/workspace")),
        );
        session.history.push(serde_json::json!({"role": "user", "content": "hello"}));

        let file_path = manager.save_session(&session).expect("save session");
        let loaded = manager
            .load_session("session-1")
            .expect("load session")
            .expect("session exists");
        let persisted_json: serde_json::Value = serde_json::from_slice(
            &fs::read(&file_path).expect("read persisted session json"),
        )
        .expect("parse persisted session json");

        assert_eq!(file_path, base_dir.join("session-1").join("session.json"));
        assert_eq!(persisted_json.get("version").and_then(|v| v.as_u64()), Some(1));
        assert!(persisted_json.get("session").is_some());
        assert_eq!(loaded.session_id, session.session_id);
        assert_eq!(loaded.profile_id, session.profile_id);
        assert_eq!(loaded.work_dir, session.work_dir);
        assert_eq!(loaded.history, session.history);

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn checks_existence_and_deletes_session_by_public_lifecycle_api() {
        let base_dir = std::env::temp_dir().join(format!(
            "qnai-agent-session-manager-lifecycle-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before unix epoch")
                .as_nanos()
        ));
        let manager = AgentSessionManager::new(super::super::agent_persistence::AgentPersistence::new(base_dir.clone()));
        let session = AgentSession::new(
            "../Session:One".into(),
            AgentProfileId::BuiltInCode,
            Some(PathBuf::from("E:/workspace")),
        );

        assert!(!manager.session_exists("../Session:One"));

        manager.save_session(&session).expect("save session");
        assert!(manager.session_exists("../Session:One"));

        manager
            .delete_session("../Session:One")
            .expect("delete session");
        assert!(!manager.session_exists("../Session:One"));

        let _ = fs::remove_dir_all(base_dir);
    }
}
