use crate::error::{AppError, Result};
use crate::models::config::{Config, EngineId};
use std::path::PathBuf;
use tauri::{State, Window};

mod claude;
mod codex;
mod gemini;
mod history;
mod iflow;
mod session;
mod utils;

pub use history::{
    get_claude_code_session_history, get_iflow_file_contexts, get_iflow_session_history,
    get_iflow_token_stats, list_claude_code_sessions, list_iflow_sessions,
};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartChatPayload {
    message: String,
    work_dir: Option<String>,
    engine_id: Option<String>,
    system_prompt: Option<String>,
    session_id: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinueChatPayload {
    session_id: String,
    message: String,
    work_dir: Option<String>,
    engine_id: Option<String>,
    system_prompt: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterruptChatPayload {
    session_id: String,
}

pub struct ChatContext<'a> {
    pub window: Window,
    pub state: State<'a, crate::AppState>,
    pub config: Config,
}

impl<'a> ChatContext<'a> {
    fn new(window: Window, state: State<'a, crate::AppState>, config: Config) -> Self {
        Self { window, state, config }
    }
}

pub struct StartChatArgs {
    pub message: String,
    pub system_prompt: Option<String>,
    pub session_id: Option<String>,
}

pub struct ContinueChatArgs {
    pub session_id: String,
    pub message: String,
    pub system_prompt: Option<String>,
}

const DEFAULT_ENGINE: EngineId = EngineId::ClaudeCode;

#[tauri::command]
pub async fn start_chat(
    window: Window,
    state: State<'_, crate::AppState>,
    payload: StartChatPayload,
) -> Result<String> {
    let config = resolve_config(&state, payload.work_dir.as_deref())?;
    let engine = resolve_engine_id(payload.engine_id.as_deref(), &config);
    let ctx = ChatContext::new(window, state, config);
    let args = StartChatArgs {
        message: payload.message,
        system_prompt: payload.system_prompt,
        session_id: payload.session_id,
    };

    match engine {
        EngineId::ClaudeCode => claude::start_claude_chat(&ctx, &args).await,
        EngineId::CodexCli => codex::start_codex_chat(&ctx, &args).await,
        EngineId::IFlow => iflow::start_iflow_chat(&ctx, &args).await,
        EngineId::Gemini => gemini::start_gemini_chat(&ctx, &args).await,
    }
}

#[tauri::command]
pub async fn continue_chat(
    window: Window,
    state: State<'_, crate::AppState>,
    payload: ContinueChatPayload,
) -> Result<()> {
    let config = resolve_config(&state, payload.work_dir.as_deref())?;
    let engine = resolve_engine_id(payload.engine_id.as_deref(), &config);
    let ctx = ChatContext::new(window, state, config);
    let args = ContinueChatArgs {
        session_id: payload.session_id,
        message: payload.message,
        system_prompt: payload.system_prompt,
    };

    match engine {
        EngineId::ClaudeCode => claude::continue_claude_chat(&ctx, &args).await,
        EngineId::CodexCli => codex::continue_codex_chat(&ctx, &args).await,
        EngineId::IFlow => iflow::continue_iflow_chat(&ctx, &args).await,
        EngineId::Gemini => gemini::continue_gemini_chat(&ctx, &args).await,
    }
}

#[tauri::command]
pub async fn interrupt_chat(
    state: State<'_, crate::AppState>,
    payload: InterruptChatPayload,
) -> Result<()> {
    let session_id = payload.session_id;
    let pid_opt = {
        let mut sessions = state.sessions.lock()
            .map_err(|e| AppError::Unknown(e.to_string()))?;
        sessions.remove(&session_id)
    };

    let pid = match pid_opt {
        Some(pid) => pid,
        None => return Err(AppError::ProcessError(format!("未找到会话: {}", session_id))),
    };

    utils::terminate_process(pid);
    Ok(())
}

fn resolve_engine_id(engine_id: Option<&str>, config: &Config) -> EngineId {
    let engine_id_str = engine_id.unwrap_or(&config.default_engine);
    EngineId::from_str(engine_id_str).unwrap_or(DEFAULT_ENGINE)
}

fn resolve_config(
    state: &State<'_, crate::AppState>,
    work_dir: Option<&str>,
) -> Result<Config> {
    let config_store = state.config_store.lock()
        .map_err(|e| AppError::Unknown(e.to_string()))?;
    let mut config = config_store.get().clone();

    if let Some(path) = work_dir {
        config.work_dir = Some(PathBuf::from(path));
    }

    Ok(config)
}
