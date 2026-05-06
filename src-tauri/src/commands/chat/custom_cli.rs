use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::commands::chat::utils::{register_session_runtime, remove_session_runtime, resolve_session_pid, terminate_process};
use crate::error::Result;
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
    );

    Ok(session_id)
}

pub async fn continue_custom_cli_chat(ctx: &ChatContext<'_>, args: &ContinueChatArgs) -> Result<()> {
    terminate_existing_session(&ctx.state.sessions, &args.session_id);

    let request = CustomCliService::continue_request_builder(args.session_id.clone(), args.message.clone())
        .system_prompt(args.system_prompt.as_deref())
        .build();
    let spawn_result = CustomCliService::spawn_custom_cli(&ctx.config)?;
    let pid = spawn_result.child.id();
    let mut stdin = spawn_result.stdin;
    CustomCliService::write_request(&mut stdin, &request)?;

    register_session_runtime(&ctx.state.sessions, &args.session_id, pid);
    if let Ok(mut handles) = ctx.state.stdin_handles.lock() {
        handles.insert(args.session_id.clone(), stdin);
    }

    CustomCliService::forward_stdout_events(
        spawn_result.child,
        args.session_id.clone(),
        ctx.window.clone(),
        std::sync::Arc::clone(&ctx.state.sessions),
    );

    Ok(())
}

fn terminate_existing_session(
    sessions: &std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, crate::SessionRuntime>>>,
    session_id: &str,
) {
    let pid_opt = resolve_session_pid(sessions, session_id);
    let _ = remove_session_runtime(sessions, session_id);
    if let Some(pid) = pid_opt {
        terminate_process(pid);
    }
}
