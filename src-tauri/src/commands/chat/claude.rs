use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::error::{AppError, Result};
use crate::models::events::StreamEvent;
use crate::SessionRuntimeKind;
use std::sync::Arc;

use crate::commands::chat::session::{
    build_claude_command, ChatSession, ClaudeCommandArgs, ClaudeOutputMode, ClaudeStartParams,
};
use crate::commands::chat::utils::{
    emit_stream_event, register_session_runtime, remove_session_runtime, resolve_session_pid,
    terminate_process, update_session_mapping,
};
use crate::SessionRuntime;
use std::collections::HashMap;
use std::sync::Mutex;

pub async fn start_claude_chat(ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let mut session = ChatSession::start(ClaudeStartParams {
        config: &ctx.config,
        message: &args.message,
        system_prompt: args.system_prompt.as_deref(),
        session_id: args.session_id.clone(),
    })?;

    let session_id = session.id.clone();
    let pid = session.child.id();
    register_session_runtime(&ctx.state.sessions, &session_id, SessionRuntimeKind::Process { pid });

    if let Some(stdin) = session.child.stdin.take() {
        if let Ok(mut handles) = ctx.state.stdin_handles.lock() {
            handles.insert(session_id.clone(), stdin);
        }
    }

    spawn_claude_reader(ClaudeReaderArgs {
        session,
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
        stdin_handles: Arc::clone(&ctx.state.stdin_handles),
        initial_session_id: session_id.clone(),
    });
    Ok(session_id)
}

pub async fn continue_claude_chat(ctx: &ChatContext<'_>, args: &ContinueChatArgs) -> Result<()> {
    terminate_existing_session(&ctx.state.sessions, &ctx.state.stdin_handles, &args.session_id);
    let mut child = spawn_claude_process(ClaudeProcessArgs {
        config: &ctx.config,
        message: &args.message,
        system_prompt: args.system_prompt.as_deref(),
        resume_session_id: Some(&args.session_id),
    })?;

    let pid = child.id();
    register_session_runtime(&ctx.state.sessions, &args.session_id, SessionRuntimeKind::Process { pid });

    if let Some(stdin) = child.stdin.take() {
        if let Ok(mut handles) = ctx.state.stdin_handles.lock() {
            handles.insert(args.session_id.clone(), stdin);
        }
    }

    let session = ChatSession::with_id_and_child(args.session_id.clone(), child);
    spawn_claude_reader(ClaudeReaderArgs {
        session,
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
        stdin_handles: Arc::clone(&ctx.state.stdin_handles),
        initial_session_id: args.session_id.clone(),
    });
    Ok(())
}


struct ClaudeProcessArgs<'a> {
    config: &'a crate::models::config::Config,
    message: &'a str,
    system_prompt: Option<&'a str>,
    resume_session_id: Option<&'a str>,
}

struct ClaudeReaderArgs {
    session: ChatSession,
    window: tauri::Window,
    sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>,
    stdin_handles: Arc<Mutex<HashMap<String, std::process::ChildStdin>>>,
    initial_session_id: String,
}

fn spawn_claude_process(args: ClaudeProcessArgs<'_>) -> Result<std::process::Child> {
    let mut cmd = build_claude_command(ClaudeCommandArgs {
        config: args.config,
        message: args.message,
        system_prompt: args.system_prompt,
        resume_session_id: args.resume_session_id,
        output_mode: ClaudeOutputMode::StreamJson,
    })?;
    cmd.spawn()
        .map_err(|e| AppError::ProcessError(format!("继续 Claude 失败: {}", e)))
}

fn spawn_claude_reader(args: ClaudeReaderArgs) {
    std::thread::spawn(move || {
        let mut state = ClaudeEventState::new(args.sessions, args.stdin_handles, args.initial_session_id);
        args.session.read_events(move |event| {
            state.update_session_id(&event);
            state.emit_event(&args.window, &event);
            state.maybe_cleanup(&event);
        });
    });
}


fn terminate_existing_session(
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    stdin_handles: &Arc<Mutex<HashMap<String, std::process::ChildStdin>>>,
    session_id: &str,
) {
    let pid_opt = resolve_session_pid(sessions, session_id);
    let _ = remove_session_runtime(sessions, session_id);
    if let Ok(mut handles) = stdin_handles.lock() {
        handles.remove(session_id);
    }
    if let Some(pid) = pid_opt {
        terminate_process(pid);
    }
}

struct ClaudeEventState {
    sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>,
    stdin_handles: Arc<Mutex<HashMap<String, std::process::ChildStdin>>>,
    temp_session_id: String,
    emit_session_id: String,
}

impl ClaudeEventState {
    fn new(
        sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>,
        stdin_handles: Arc<Mutex<HashMap<String, std::process::ChildStdin>>>,
        temp_session_id: String,
    ) -> Self {
        Self {
            sessions,
            stdin_handles,
            emit_session_id: temp_session_id.clone(),
            temp_session_id,
        }
    }

    fn update_session_id(&mut self, event: &StreamEvent) {
        let new_id = match event {
            StreamEvent::System { extra, .. } => extra.get("session_id"),
            _ => None,
        }
        .and_then(|value| value.as_str())
        .map(|value| value.to_string());

        let new_id = match new_id {
            Some(id) => id,
            None => return,
        };

        if new_id == self.emit_session_id {
            return;
        }

        if update_session_mapping(&self.sessions, &self.temp_session_id, &new_id).is_some() {
            if let Ok(mut handles) = self.stdin_handles.lock() {
                if let Some(stdin) = handles.remove(&self.temp_session_id) {
                    handles.insert(new_id.clone(), stdin);
                }
            }
            self.emit_session_id = new_id;
        }
    }

    fn emit_event(&self, window: &tauri::Window, event: &StreamEvent) {
        emit_stream_event(window, event, &self.emit_session_id);
    }

    fn maybe_cleanup(&self, event: &StreamEvent) {
        if matches!(event, StreamEvent::SessionEnd { .. }) {
            let _ = remove_session_runtime(&self.sessions, &self.emit_session_id);
            if let Ok(mut handles) = self.stdin_handles.lock() {
                handles.remove(&self.emit_session_id);
                if self.emit_session_id != self.temp_session_id {
                    handles.remove(&self.temp_session_id);
                }
            }
        }
    }
}
