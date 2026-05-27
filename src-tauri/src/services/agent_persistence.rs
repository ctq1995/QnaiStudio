use std::fs;
use std::path::{Path, PathBuf};

use crate::error::Result;

const AGENT_SESSION_DIR: &str = ".qnai/agent-sessions";
const SESSION_FILE_NAME: &str = "session.json";

#[derive(Debug, Clone)]
pub struct AgentPersistence {
    base_dir: PathBuf,
}

impl AgentPersistence {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    pub fn from_work_dir(work_dir: &Path) -> Self {
        Self::new(work_dir.join(AGENT_SESSION_DIR))
    }

    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    pub fn ensure_base_dir(&self) -> Result<()> {
        fs::create_dir_all(&self.base_dir)?;
        Ok(())
    }

    pub fn session_storage_key(&self, session_id: &str) -> String {
        let trimmed = session_id.trim();
        if trimmed.is_empty() {
            return "session".to_string();
        }

        let mut key = String::with_capacity(trimmed.len());
        let mut last_was_separator = false;

        for ch in trimmed.chars() {
            let normalized = match ch {
                'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => Some(ch.to_ascii_lowercase()),
                _ => None,
            };

            if let Some(normalized) = normalized {
                key.push(normalized);
                last_was_separator = false;
            } else if !last_was_separator {
                key.push('_');
                last_was_separator = true;
            }
        }

        let key = key.trim_matches('_');
        if key.is_empty() {
            "session".to_string()
        } else {
            key.to_string()
        }
    }

    pub fn session_dir(&self, session_id: &str) -> PathBuf {
        self.base_dir.join(self.session_storage_key(session_id))
    }

    pub fn session_file(&self, session_id: &str) -> PathBuf {
        self.session_dir(session_id).join(SESSION_FILE_NAME)
    }

    pub fn session_exists(&self, session_id: &str) -> bool {
        self.session_file(session_id).exists()
    }

    pub fn ensure_session_dir(&self, session_id: &str) -> Result<PathBuf> {
        let session_dir = self.session_dir(session_id);
        fs::create_dir_all(&session_dir)?;
        Ok(session_dir)
    }

    pub fn delete_session_dir(&self, session_id: &str) -> Result<()> {
        let session_dir = self.session_dir(session_id);
        if session_dir.exists() {
            fs::remove_dir_all(session_dir)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::AgentPersistence;

    #[test]
    fn builds_session_file_under_qnai_directory() {
        let persistence = AgentPersistence::from_work_dir(std::path::Path::new("E:/workspace"));

        assert!(persistence
            .session_file("session-1")
            .ends_with(".qnai/agent-sessions/session-1/session.json"));
    }

    #[test]
    fn normalizes_session_id_before_joining_path() {
        let persistence = AgentPersistence::from_work_dir(std::path::Path::new("E:/workspace"));

        assert_eq!(
            persistence.session_storage_key(" ../Session:One\\Two "),
            "session_one_two"
        );
        assert!(persistence
            .session_file(" ../Session:One\\Two ")
            .ends_with(".qnai/agent-sessions/session_one_two/session.json"));
    }
}
