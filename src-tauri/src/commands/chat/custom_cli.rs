use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::commands::chat::utils::{emit_chat_event, register_session_runtime};
use crate::error::{AppError, Result};
use crate::services::agent_runtime::AgentRuntime;
use crate::SessionRuntimeKind;
use uuid::Uuid;

pub async fn start_custom_cli_chat(ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let session_id = args.session_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let runtime = AgentRuntime::new(
        ctx.state.agent_sessions.clone(),
        ctx.state.built_in_agent_sessions.clone(),
        ctx.state.agent_session_manager.clone(),
    );
    let events = runtime
        .start_built_in_session(session_id.clone(), &ctx.config, &args.message)
        .await?;

    register_session_runtime(&ctx.state.sessions, &session_id, SessionRuntimeKind::BuiltIn);

    for event in events {
        emit_chat_event(&ctx.window, serde_json::to_value(event).map_err(|e| AppError::Unknown(e.to_string()))?, &session_id);
    }

    Ok(session_id)
}

pub async fn continue_custom_cli_chat(ctx: &ChatContext<'_>, args: &ContinueChatArgs) -> Result<()> {
    let runtime = AgentRuntime::new(
        ctx.state.agent_sessions.clone(),
        ctx.state.built_in_agent_sessions.clone(),
        ctx.state.agent_session_manager.clone(),
    );
    let events = runtime.continue_built_in_session(&args.session_id, &args.message).await?;

    for event in events {
        emit_chat_event(
            &ctx.window,
            serde_json::to_value(event).map_err(|e| AppError::Unknown(e.to_string()))?,
            &args.session_id,
        );
    }

    Ok(())
}


