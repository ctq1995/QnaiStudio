use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::commands::chat::utils::{
    emit_chat_event, register_session_runtime, remove_session_runtime, resolve_session_pid,
    terminate_process,
};
use crate::error::Result;
use crate::services::gemini_service::GeminiService;
use crate::SessionRuntime;
use crate::SessionRuntimeKind;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

const EVENT_TYPE_KEY: &str = "type";
const SESSION_END_TYPE: &str = "session_end";

pub async fn start_gemini_chat(ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let session_id = args.session_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let child = GeminiService::start_chat(&ctx.config, &args.message)?;
    let pid = child.id();
    register_session_runtime(&ctx.state.sessions, &session_id, SessionRuntimeKind::Process { pid });
    spawn_gemini_reader(GeminiReaderArgs {
        child,
        session_id: session_id.clone(),
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
    });
    Ok(session_id)
}

pub async fn continue_gemini_chat(ctx: &ChatContext<'_>, args: &ContinueChatArgs) -> Result<()> {
    terminate_existing_session(&ctx.state.sessions, &args.session_id);
    let child = GeminiService::start_chat(&ctx.config, &args.message)?;
    let pid = child.id();
    register_session_runtime(&ctx.state.sessions, &args.session_id, SessionRuntimeKind::Process { pid });
    spawn_gemini_reader(GeminiReaderArgs {
        child,
        session_id: args.session_id.clone(),
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
    });
    Ok(())
}


struct GeminiReaderArgs {
    child: std::process::Child,
    session_id: String,
    window: tauri::Window,
    sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>,
}

fn spawn_gemini_reader(args: GeminiReaderArgs) {
    std::thread::spawn(move || {
        GeminiService::read_events(args.child, move |event| {
            if is_session_end(&event) {
                let _ = remove_session_runtime(&args.sessions, &args.session_id);
            }
            emit_chat_event(&args.window, event, &args.session_id);
        });
    });
}

fn is_session_end(event: &Value) -> bool {
    event.get(EVENT_TYPE_KEY)
        .and_then(Value::as_str)
        .map(|value| value == SESSION_END_TYPE)
        .unwrap_or(false)
}

fn terminate_existing_session(
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    session_id: &str,
) {
    let pid_opt = resolve_session_pid(sessions, session_id);
    let _ = remove_session_runtime(sessions, session_id);
    if let Some(pid) = pid_opt {
        terminate_process(pid);
    }
}
