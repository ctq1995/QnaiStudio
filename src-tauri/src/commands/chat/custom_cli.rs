use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::commands::chat::utils::{emit_chat_event, register_session_runtime};
use crate::error::{AppError, Result};
use crate::models::events::StreamEvent;
use crate::services::agent_runtime::AgentRuntime;
use crate::SessionRuntimeKind;
use uuid::Uuid;

pub async fn start_custom_cli_chat(ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let session_id = args
        .session_id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let runtime = AgentRuntime::new(
        ctx.state.agent_sessions.clone(),
        ctx.state.built_in_agent_sessions.clone(),
        ctx.state.agent_session_manager.clone(),
    );
    register_session_runtime(
        &ctx.state.sessions,
        &session_id,
        SessionRuntimeKind::BuiltIn,
    );

    let emitted_text_delta = Arc::new(AtomicBool::new(false));
    let emitted_text_delta_for_sink = emitted_text_delta.clone();
    let window_for_sink = ctx.window.clone();
    let session_id_for_sink = session_id.clone();
    let events = runtime
        .start_built_in_session_with_text_sink(
            session_id.clone(),
            &ctx.config,
            &args.message,
            move |text| {
                emitted_text_delta_for_sink.store(true, Ordering::SeqCst);
                let event = StreamEvent::TextDelta { text };
                if let Ok(value) = serde_json::to_value(event) {
                    emit_chat_event(&window_for_sink, value, &session_id_for_sink);
                }
            },
        )
        .await?;

    for event in events {
        if emitted_text_delta.load(Ordering::SeqCst)
            && matches!(event, StreamEvent::TextDelta { .. })
        {
            continue;
        }
        emit_chat_event(
            &ctx.window,
            serde_json::to_value(event).map_err(|e| AppError::Unknown(e.to_string()))?,
            &session_id,
        );
    }

    Ok(session_id)
}

pub async fn continue_custom_cli_chat(
    ctx: &ChatContext<'_>,
    args: &ContinueChatArgs,
) -> Result<()> {
    let runtime = AgentRuntime::new(
        ctx.state.agent_sessions.clone(),
        ctx.state.built_in_agent_sessions.clone(),
        ctx.state.agent_session_manager.clone(),
    );
    let emitted_text_delta = Arc::new(AtomicBool::new(false));
    let emitted_text_delta_for_sink = emitted_text_delta.clone();
    let window_for_sink = ctx.window.clone();
    let session_id_for_sink = args.session_id.clone();
    let events = runtime
        .continue_built_in_session_with_text_sink(&args.session_id, &args.message, move |text| {
            emitted_text_delta_for_sink.store(true, Ordering::SeqCst);
            let event = StreamEvent::TextDelta { text };
            if let Ok(value) = serde_json::to_value(event) {
                emit_chat_event(&window_for_sink, value, &session_id_for_sink);
            }
        })
        .await?;

    for event in events {
        if emitted_text_delta.load(Ordering::SeqCst)
            && matches!(event, StreamEvent::TextDelta { .. })
        {
            continue;
        }
        emit_chat_event(
            &ctx.window,
            serde_json::to_value(event).map_err(|e| AppError::Unknown(e.to_string()))?,
            &args.session_id,
        );
    }

    Ok(())
}
