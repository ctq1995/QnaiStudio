use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::error::{AppError, Result};
use crate::models::events::StreamEvent;
use std::sync::Arc;

use crate::commands::chat::session::{
    build_claude_command, ChatSession, ClaudeCommandArgs, ClaudeStartParams,
};
use crate::commands::chat::utils::{emit_stream_event, terminate_process, update_session_mapping};
use std::collections::HashMap;
use std::sync::Mutex;

pub async fn start_claude_chat(ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let session = ChatSession::start(ClaudeStartParams {
        config: &ctx.config,
        message: &args.message,
        system_prompt: args.system_prompt.as_deref(),
        session_id: args.session_id.clone(),
    })?;

    let session_id = session.id.clone();
    let pid = session.child.id();
    store_session_pid(&ctx.state.sessions, &session_id, pid)?;
    spawn_claude_reader(ClaudeReaderArgs {
        session,
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
        initial_session_id: session_id.clone(),
    });
    Ok(session_id)
}

pub async fn continue_claude_chat(ctx: &ChatContext<'_>, args: &ContinueChatArgs) -> Result<()> {
    terminate_existing_session(&ctx.state.sessions, &args.session_id);
    let child = spawn_claude_process(ClaudeProcessArgs {
        config: &ctx.config,
        message: &args.message,
        system_prompt: args.system_prompt.as_deref(),
        resume_session_id: Some(&args.session_id),
    })?;

    let pid = child.id();
    store_session_pid(&ctx.state.sessions, &args.session_id, pid)?;
    let session = ChatSession::with_id_and_child(args.session_id.clone(), child);
    spawn_claude_reader(ClaudeReaderArgs {
        session,
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
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
    sessions: Arc<Mutex<HashMap<String, u32>>>,
    initial_session_id: String,
}

fn spawn_claude_process(args: ClaudeProcessArgs<'_>) -> Result<std::process::Child> {
    let mut cmd = build_claude_command(ClaudeCommandArgs {
        config: args.config,
        message: args.message,
        system_prompt: args.system_prompt,
        resume_session_id: args.resume_session_id,
    })?;
    cmd.spawn()
        .map_err(|e| AppError::ProcessError(format!("继续 Claude 失败: {}", e)))
}

fn spawn_claude_reader(args: ClaudeReaderArgs) {
    std::thread::spawn(move || {
        let mut state = ClaudeEventState::new(args.sessions, args.initial_session_id);
        args.session.read_events(move |event| {
            state.update_session_id(&event);
            state.emit_event(&args.window, &event);
            state.maybe_cleanup(&event);
        });
    });
}

fn store_session_pid(
    sessions: &Arc<Mutex<HashMap<String, u32>>>,
    session_id: &str,
    pid: u32,
) -> Result<()> {
    let mut sessions = sessions.lock()
        .map_err(|e| AppError::Unknown(e.to_string()))?;
    sessions.insert(session_id.to_string(), pid);
    Ok(())
}

fn remove_session(sessions: &Arc<Mutex<HashMap<String, u32>>>, session_id: &str) {
    if let Ok(mut sessions) = sessions.lock() {
        sessions.remove(session_id);
    }
}

fn terminate_existing_session(sessions: &Arc<Mutex<HashMap<String, u32>>>, session_id: &str) {
    let pid_opt = sessions.lock().ok().and_then(|mut sessions| sessions.remove(session_id));
    if let Some(pid) = pid_opt {
        terminate_process(pid);
    }
}

struct ClaudeEventState {
    sessions: Arc<Mutex<HashMap<String, u32>>>,
    temp_session_id: String,
    emit_session_id: String,
}

impl ClaudeEventState {
    fn new(sessions: Arc<Mutex<HashMap<String, u32>>>, temp_session_id: String) -> Self {
        Self {
            sessions,
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
            self.emit_session_id = new_id;
        }
    }

    fn emit_event(&self, window: &tauri::Window, event: &StreamEvent) {
        emit_stream_event(window, event, &self.emit_session_id);
    }

    fn maybe_cleanup(&self, event: &StreamEvent) {
        if matches!(event, StreamEvent::SessionEnd) {
            remove_session(&self.sessions, &self.emit_session_id);
        }
    }
}
