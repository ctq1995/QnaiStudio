use crate::error::{AppError, Result};
use crate::models::iflow_events::{
    IFlowFileContext, IFlowHistoryMessage, IFlowSessionMeta, IFlowTokenStats,
};
use std::path::{Path, PathBuf};

const FIRST_PROMPT_PREVIEW_LEN: usize = 100;
const TRUNCATE_SUFFIX: &str = "...";
const TRUNCATE_SUFFIX_LEN: usize = 3;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCodeSessionMeta {
    pub session_id: String,
    pub first_prompt: String,
    pub message_count: u32,
    pub created: String,
    pub modified: String,
    pub file_path: String,
    pub file_size: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCodeMessage {
    pub role: String,
    pub content: serde_json::Value,
    pub timestamp: Option<String>,
}

#[tauri::command]
pub async fn list_iflow_sessions(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<IFlowSessionMeta>> {
    let config = load_config(&state)?;
    crate::services::iflow_service::IFlowService::list_sessions(&config)
}

#[tauri::command]
pub async fn get_iflow_session_history(
    session_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<IFlowHistoryMessage>> {
    let config = load_config(&state)?;
    crate::services::iflow_service::IFlowService::get_session_history(&config, &session_id)
}

#[tauri::command]
pub async fn get_iflow_file_contexts(
    session_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<IFlowFileContext>> {
    let config = load_config(&state)?;
    crate::services::iflow_service::IFlowService::get_file_contexts(&config, &session_id)
}

#[tauri::command]
pub async fn get_iflow_token_stats(
    session_id: String,
    state: tauri::State<'_, crate::AppState>,
) -> Result<IFlowTokenStats> {
    let config = load_config(&state)?;
    crate::services::iflow_service::IFlowService::get_token_stats(&config, &session_id)
}

#[tauri::command]
pub async fn list_claude_code_sessions(
    project_path: Option<String>,
) -> Result<Vec<ClaudeCodeSessionMeta>> {
    let project_dir = resolve_project_dir(project_path)?;
    let project_name = project_name_from_path(&project_dir);
    let index_path = sessions_index_path(&project_name);
    if !index_path.exists() {
        return Ok(vec![]);
    }

    let index = read_json_file(&index_path)?;
    let sessions = parse_session_index(&index);
    Ok(sort_sessions(sessions))
}

#[tauri::command]
pub async fn get_claude_code_session_history(
    session_id: String,
    project_path: Option<String>,
) -> Result<Vec<ClaudeCodeMessage>> {
    let project_dir = resolve_project_dir(project_path)?;
    let session_file_path = session_file_path(&project_dir, &session_id);
    if !session_file_path.exists() {
        return Err(AppError::Unknown(format!("会话文件不存在: {:?}", session_file_path)));
    }

    let content = std::fs::read_to_string(&session_file_path)
        .map_err(|e| AppError::Unknown(format!("读取会话文件失败: {}", e)))?;
    Ok(parse_session_messages(&content))
}

fn load_config(state: &tauri::State<'_, crate::AppState>) -> Result<crate::models::config::Config> {
    let config_store = state.config_store.lock()
        .map_err(|e| AppError::Unknown(e.to_string()))?;
    Ok(config_store.get().clone())
}

fn resolve_project_dir(project_path: Option<String>) -> Result<PathBuf> {
    match project_path {
        Some(path) => Ok(PathBuf::from(path)),
        None => std::env::current_dir()
            .map_err(|e| AppError::Unknown(format!("获取当前目录失败: {}", e))),
    }
}

fn sessions_index_path(project_name: &str) -> PathBuf {
    claude_projects_dir().join(project_name).join("sessions-index.json")
}

fn session_file_path(project_dir: &Path, session_id: &str) -> PathBuf {
    let project_name = project_name_from_path(project_dir);
    claude_projects_dir().join(project_name).join(format!("{}.jsonl", session_id))
}

fn read_json_file(path: &Path) -> Result<serde_json::Value> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| AppError::Unknown(format!("读取索引文件失败: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| AppError::Unknown(format!("解析索引文件失败: {}", e)))
}

fn parse_session_index(index: &serde_json::Value) -> Vec<ClaudeCodeSessionMeta> {
    let entries = match index.get("entries").and_then(|v| v.as_array()) {
        Some(entries) => entries,
        None => return vec![],
    };

    entries.iter().filter_map(build_session_meta).collect()
}

fn build_session_meta(entry: &serde_json::Value) -> Option<ClaudeCodeSessionMeta> {
    let session_id = entry.get("sessionId")?.as_str()?;
    let first_prompt = entry.get("firstPrompt")?.as_str()?;
    let message_count = entry.get("messageCount")?.as_u64()?;
    let created = entry.get("created")?.as_str()?;
    let modified = entry.get("modified")?.as_str()?;
    let full_path = entry.get("fullPath")?.as_str()?;
    let file_size = std::fs::metadata(full_path).map(|m| m.len()).unwrap_or(0);

    Some(ClaudeCodeSessionMeta {
        session_id: session_id.to_string(),
        first_prompt: truncate_string(first_prompt, FIRST_PROMPT_PREVIEW_LEN),
        message_count: message_count as u32,
        created: created.to_string(),
        modified: modified.to_string(),
        file_path: full_path.to_string(),
        file_size,
    })
}

fn sort_sessions(sessions: Vec<ClaudeCodeSessionMeta>) -> Vec<ClaudeCodeSessionMeta> {
    let mut sorted = sessions;
    sorted.sort_by(|a, b| b.modified.cmp(&a.modified));
    sorted
}

fn parse_session_messages(content: &str) -> Vec<ClaudeCodeMessage> {
    let mut messages = Vec::new();
    for line in content.lines() {
        if let Some(message) = parse_message_line(line) {
            messages.push(message);
        }
    }
    messages
}

fn parse_message_line(line: &str) -> Option<ClaudeCodeMessage> {
    let entry: serde_json::Value = serde_json::from_str(line).ok()?;
    let entry_type = entry.get("type").and_then(|v| v.as_str())?;
    if entry_type != "user" && entry_type != "assistant" {
        return None;
    }

    let message = entry.get("message")?;
    let content_val = message.get("content").cloned().unwrap_or(serde_json::json!(""));
    let timestamp = entry.get("timestamp").and_then(|v| v.as_str()).map(|s| s.to_string());

    Some(ClaudeCodeMessage {
        role: entry_type.to_string(),
        content: content_val,
        timestamp,
    })
}

fn project_name_from_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace(':', "--")
        .replace("\\", "-")
        .replace("/", "-")
        .replace("---", "--")
}

fn claude_projects_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Some(userprofile) = std::env::var("USERPROFILE").ok() {
            return PathBuf::from(userprofile).join(".claude").join("projects");
        }
    }

    #[cfg(not(windows))]
    {
        if let Some(home) = std::env::var("HOME").ok() {
            return PathBuf::from(home).join(".claude").join("projects");
        }
    }

    PathBuf::from(".claude").join("projects")
}

fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        return s.to_string();
    }

    let mut truncated = s.chars().take(max_len.saturating_sub(TRUNCATE_SUFFIX_LEN)).collect::<String>();
    truncated.push_str(TRUNCATE_SUFFIX);
    truncated
}
