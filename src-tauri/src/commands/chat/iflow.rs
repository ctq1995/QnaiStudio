use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::commands::chat::utils::{
    emit_chat_event, emit_stream_event, extract_session_id, terminate_process, update_session_mapping,
};
use crate::error::{AppError, Result};
use crate::services::iflow_service::{IFlowService, IFlowSession};
use crate::utils::encoding::decode_cli_line;
use serde_json::json;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const START_LINE_BEGIN: usize = 0;

pub async fn start_iflow_chat(ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let mut session = IFlowService::start_chat(&ctx.config, &args.message)?;
    let temp_session_id = args.session_id.clone().unwrap_or_else(|| session.id.clone());
    session.id = temp_session_id.clone();
    let pid = session.child.id();
    store_session_pid(&ctx.state.sessions, &temp_session_id, pid)?;
    spawn_iflow_start_thread(IflowStartThreadArgs {
        session,
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
        config: ctx.config.clone(),
    });
    Ok(temp_session_id)
}

pub async fn continue_iflow_chat(ctx: &ChatContext<'_>, args: &ContinueChatArgs) -> Result<()> {
    terminate_existing_session(&ctx.state.sessions, &args.session_id);
    let child = IFlowService::continue_chat(&ctx.config, &args.session_id, &args.message)?;
    let pid = child.id();
    store_session_pid(&ctx.state.sessions, &args.session_id, pid)?;
    spawn_iflow_continue_thread(IflowContinueThreadArgs {
        child,
        session_id: args.session_id.clone(),
        window: ctx.window.clone(),
        sessions: Arc::clone(&ctx.state.sessions),
        config: ctx.config.clone(),
    });
    Ok(())
}

struct IflowStartThreadArgs {
    session: IFlowSession,
    window: tauri::Window,
    sessions: Arc<Mutex<HashMap<String, u32>>>,
    config: crate::models::config::Config,
}

struct IflowContinueThreadArgs {
    child: std::process::Child,
    session_id: String,
    window: tauri::Window,
    sessions: Arc<Mutex<HashMap<String, u32>>>,
    config: crate::models::config::Config,
}

fn spawn_iflow_start_thread(args: IflowStartThreadArgs) {
    std::thread::spawn(move || {
        let mut state = IflowStartState::new(args);
        state.run();
    });
}

fn spawn_iflow_continue_thread(mut args: IflowContinueThreadArgs) {
    std::thread::spawn(move || {
        let start_line = resolve_start_line(&args.config, &args.session_id);
        if let Some(jsonl_path) = IFlowService::find_session_jsonl(&args.config, &args.session_id).ok() {
            start_jsonl_monitor(JsonlMonitorArgs {
                jsonl_path,
                session_id: args.session_id.clone(),
                window: args.window.clone(),
                sessions: Arc::clone(&args.sessions),
                start_line,
            });
        }
        let _ = args.child.wait();
    });
}

struct IflowStartState {
    session: IFlowSession,
    window: tauri::Window,
    sessions: Arc<Mutex<HashMap<String, u32>>>,
    config: crate::models::config::Config,
    resolved_session_id: Option<String>,
}

impl IflowStartState {
    fn new(args: IflowStartThreadArgs) -> Self {
        Self {
            session: args.session,
            window: args.window,
            sessions: args.sessions,
            config: args.config,
            resolved_session_id: None,
        }
    }

    fn run(&mut self) {
        let stderr = self.session.child.stderr.take();
        if let Some(stderr) = stderr {
            self.read_stderr(stderr);
        }
        let _ = self.session.child.wait();
    }

    fn read_stderr(&mut self, stderr: std::process::ChildStderr) {
        let mut reader = BufReader::new(stderr);
        let mut buffer = Vec::new();
        loop {
            buffer.clear();
            let bytes_read = match reader.read_until(b'\n', &mut buffer) {
                Ok(size) => size,
                Err(_) => break,
            };
            if bytes_read == 0 {
                break;
            }
            let line = decode_cli_line(&buffer);
            if !line.is_empty() {
                self.handle_stderr_line(line.trim());
            }
        }
    }

    fn handle_stderr_line(&mut self, line: &str) {
        if self.resolved_session_id.is_some() {
            return;
        }

        let session_id = match extract_session_id(line) {
            Some(id) => id,
            None => return,
        };

        self.resolved_session_id = Some(session_id.clone());
        let _ = update_session_mapping(&self.sessions, &self.session.id, &session_id);
        emit_chat_event(&self.window, json!({ "type": "system" }), &session_id);
        self.start_jsonl_monitor(session_id);
    }

    fn start_jsonl_monitor(&self, session_id: String) {
        let jsonl_path = match IFlowService::find_session_jsonl(&self.config, &session_id) {
            Ok(path) => path,
            Err(_) => return,
        };

        start_jsonl_monitor(JsonlMonitorArgs {
            jsonl_path,
            session_id,
            window: self.window.clone(),
            sessions: Arc::clone(&self.sessions),
            start_line: START_LINE_BEGIN,
        });
    }
}

struct JsonlMonitorArgs {
    jsonl_path: PathBuf,
    session_id: String,
    window: tauri::Window,
    sessions: Arc<Mutex<HashMap<String, u32>>>,
    start_line: usize,
}

fn start_jsonl_monitor(args: JsonlMonitorArgs) {
    let JsonlMonitorArgs { jsonl_path, session_id, window, sessions, start_line } = args;
    IFlowService::monitor_jsonl_file(
        jsonl_path,
        session_id.clone(),
        move |event| {
            emit_stream_event(&window, &event, &session_id);
            if matches!(event, crate::models::events::StreamEvent::SessionEnd) {
                remove_session(&sessions, &session_id);
            }
        },
        start_line,
    );
}

fn resolve_start_line(config: &crate::models::config::Config, session_id: &str) -> usize {
    let jsonl_path = IFlowService::find_session_jsonl(config, session_id);
    let jsonl_path = match jsonl_path {
        Ok(path) => path,
        Err(_) => return START_LINE_BEGIN,
    };

    IFlowService::get_jsonl_line_count(&jsonl_path).unwrap_or(START_LINE_BEGIN)
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
