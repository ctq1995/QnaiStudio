use crate::error::{AppError, Result};
use crate::models::config::{Config, EngineId};
use std::path::PathBuf;
use tauri::{State, Window};

mod claude;
mod codex;
mod custom_cli;
mod gemini;
mod history;
mod iflow;
pub mod session;
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

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RespondPermissionPayload {
    session_id: String,
    /** true = 批准, false = 拒绝 */
    approved: bool,
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
        EngineId::CustomCli => custom_cli::start_custom_cli_chat(&ctx, &args).await,
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
        EngineId::CustomCli => custom_cli::continue_custom_cli_chat(&ctx, &args).await,
    }
}

#[tauri::command]
pub async fn interrupt_chat(
    window: Window,
    state: State<'_, crate::AppState>,
    payload: InterruptChatPayload,
) -> Result<()> {
    let session_id = payload.session_id;
    let pid_opt = utils::resolve_session_pid(&state.sessions, &session_id);
    let _ = utils::remove_session_runtime(&state.sessions, &session_id);

    if let Some(pid) = pid_opt {
        utils::terminate_process(pid);
    }

    utils::emit_stream_event(
        &window,
        &crate::models::events::StreamEvent::SessionEnd {
            reason: "aborted".to_string(),
        },
        &session_id,
    );

    Ok(())
}

#[tauri::command]
pub async fn respond_permission(
    state: State<'_, crate::AppState>,
    payload: RespondPermissionPayload,
) -> Result<()> {
    let mut handles = state.stdin_handles.lock()
        .map_err(|e| AppError::Unknown(e.to_string()))?;

    if let Some(stdin) = handles.get_mut(&payload.session_id) {
        // Claude Code: 'y' to approve, 'n' to deny
        // Codex CLI: 'y' to approve, 'n' to deny
        // Gemini CLI: 'y' to approve, 'n' to deny
        let response = if payload.approved { "y\n" } else { "n\n" };
        use std::io::Write;
        stdin.write_all(response.as_bytes())
            .map_err(|e| AppError::Unknown(format!("写入 stdin 失败: {}", e)))?;
        stdin.flush()
            .map_err(|e| AppError::Unknown(format!("flush stdin 失败: {}", e)))?;
        Ok(())
    } else {
        Err(AppError::Unknown(format!(
            "未找到会话 {} 的 stdin 句柄，可能进程已结束或不支持权限交互",
            payload.session_id
        )))
    }
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
