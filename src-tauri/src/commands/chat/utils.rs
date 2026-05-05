use crate::models::events::StreamEvent;
use crate::utils::encoding::decode_cli_output;
use crate::SessionRuntime;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Window};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const SESSION_ID_KEY: &str = "session_id";
#[cfg(not(windows))]
const TERMINATE_GRACE_MS: u64 = 500;

pub fn emit_chat_event(window: &Window, payload: serde_json::Value, session_id: &str) {
    let payload = match payload {
        serde_json::Value::Object(mut obj) => {
            obj.insert(SESSION_ID_KEY.to_string(), serde_json::Value::String(session_id.to_string()));
            serde_json::Value::Object(obj)
        }
        other => serde_json::json!({
            "type": "unknown",
            SESSION_ID_KEY: session_id,
            "data": other
        }),
    };
    let _ = window.emit("chat-event", payload.to_string());
}

pub fn emit_stream_event(window: &Window, event: &StreamEvent, session_id: &str) {
    let payload = serde_json::to_value(event)
        .unwrap_or_else(|_| serde_json::json!({ "type": "error", "error": "事件序列化失败" }));
    emit_chat_event(window, payload, session_id);
}

pub fn register_session_runtime(
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    session_id: &str,
    pid: u32,
) {
    if let Ok(mut sessions) = sessions.lock() {
        let mut aliases = HashSet::new();
        aliases.insert(session_id.to_string());
        sessions.insert(
            session_id.to_string(),
            SessionRuntime {
                canonical_id: session_id.to_string(),
                pid,
                aliases,
            },
        );
    }
}

pub fn update_session_mapping(
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    old_id: &str,
    new_id: &str,
) -> Option<u32> {
    let mut sessions = sessions.lock().ok()?;
    let runtime = sessions.get(old_id)?.clone();
    let canonical_before = runtime.canonical_id.clone();
    let pid = runtime.pid;

    let mut aliases = runtime.aliases.clone();
    aliases.insert(old_id.to_string());
    aliases.insert(new_id.to_string());

    let updated = SessionRuntime {
        canonical_id: new_id.to_string(),
        pid,
        aliases: aliases.clone(),
    };

    for alias in &aliases {
        sessions.insert(alias.clone(), updated.clone());
    }
    if canonical_before != new_id {
        sessions.insert(new_id.to_string(), updated);
    }
    Some(pid)
}

pub fn resolve_session_pid(
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    session_id: &str,
) -> Option<u32> {
    let sessions = sessions.lock().ok()?;
    sessions.get(session_id).map(|runtime| runtime.pid)
}

pub fn remove_session_runtime(
    sessions: &Arc<Mutex<HashMap<String, SessionRuntime>>>,
    session_id: &str,
) -> Option<SessionRuntime> {
    let mut sessions = sessions.lock().ok()?;
    let runtime = sessions.get(session_id)?.clone();
    for alias in &runtime.aliases {
        sessions.remove(alias);
    }
    Some(runtime)
}

pub fn terminate_process(pid: u32) {
    #[cfg(windows)]
    {
        use std::process::Command;
        let result = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    eprintln!("[terminate_process] 成功终止进程树: {}", pid);
                } else {
                    eprintln!("[terminate_process] 终止进程失败: {}", decode_cli_output(&output.stderr));
                }
            }
            Err(e) => {
                eprintln!("[terminate_process] 执行 taskkill 失败: {}", e);
            }
        }
    }

    #[cfg(not(windows))]
    {
        use std::process::Command;
        let _ = Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .output();

        std::thread::sleep(std::time::Duration::from_millis(TERMINATE_GRACE_MS));

        let result = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    eprintln!("[terminate_process] 成功终止进程: {}", pid);
                } else {
                    eprintln!("[terminate_process] 终止进程失败: {}", decode_cli_output(&output.stderr));
                }
            }
            Err(e) => {
                eprintln!("[terminate_process] 执行 kill 失败: {}", e);
            }
        }
    }
}

pub fn extract_session_id(text: &str) -> Option<String> {
    let re = regex::Regex::new(r"session-[a-f0-9-]+").ok()?;
    re.find(text).map(|m| m.as_str().to_string())
}
