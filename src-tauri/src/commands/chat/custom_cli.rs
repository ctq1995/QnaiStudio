use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::commands::chat::utils::register_session_runtime;
use crate::error::{AppError, Result};
use crate::services::custom_cli_service::CustomCliService;
use uuid::Uuid;

pub async fn start_custom_cli_chat(ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let session_id = args.session_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let request = CustomCliService::start_request_builder(session_id.clone(), args.message.clone())
        .system_prompt(args.system_prompt.as_deref())
        .build();
    let spawn_result = CustomCliService::spawn_custom_cli(&ctx.config)?;
    let pid = spawn_result.child.id();
    let mut stdin = spawn_result.stdin;
    CustomCliService::write_request(&mut stdin, &request)?;

    register_session_runtime(&ctx.state.sessions, &session_id, pid);
    if let Ok(mut handles) = ctx.state.stdin_handles.lock() {
        handles.insert(session_id.clone(), stdin);
    }

    CustomCliService::forward_stdout_events(
        spawn_result.child,
        session_id.clone(),
        ctx.window.clone(),
        std::sync::Arc::clone(&ctx.state.sessions),
        std::sync::Arc::clone(&ctx.state.stdin_handles),
    );

    Ok(session_id)
}

pub async fn continue_custom_cli_chat(ctx: &ChatContext<'_>, args: &ContinueChatArgs) -> Result<()> {
    let request = CustomCliService::continue_request_builder(args.session_id.clone(), args.message.clone())
        .system_prompt(args.system_prompt.as_deref())
        .build();

    let mut handles = ctx.state.stdin_handles.lock()
        .map_err(|error| AppError::Unknown(error.to_string()))?;
    let stdin = handles.get_mut(&args.session_id).ok_or_else(|| {
        AppError::ProcessError(format!("未找到会话 {} 的 stdin 句柄，无法继续 custom-cli 会话", args.session_id))
    })?;
    CustomCliService::write_request(stdin, &request)
}

