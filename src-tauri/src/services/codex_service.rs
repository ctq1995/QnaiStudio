use crate::error::{AppError, Result};
use crate::utils::encoding::decode_cli_line;
use crate::models::config::Config;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const TOOL_NAME_SHELL: &str = "shell";

pub struct CodexService;

impl CodexService {
    pub fn start_chat(config: &Config, message: &str) -> Result<Child> {
        let codex_cmd = config.get_codex_cmd();
        let mut command = Self::build_exec_command(&codex_cmd, message);
        Self::apply_common_settings(&mut command, config);
        Self::spawn(command, "启动 Codex 会话")
    }

    pub fn continue_chat(config: &Config, session_id: &str, message: &str) -> Result<Child> {
        let codex_cmd = config.get_codex_cmd();
        let mut command = Self::build_resume_command(&codex_cmd, session_id, message);
        Self::apply_common_settings(&mut command, config);
        Self::spawn(command, "继续 Codex 会话")
    }

    pub fn read_events<F>(mut child: Child, mut callback: F)
    where
        F: FnMut(Value) + Send + 'static,
    {
        let stdout = match child.stdout.take() {
            Some(stdout) => stdout,
            None => {
                callback(Self::error_event("无法获取 Codex stdout"));
                return;
            }
        };

        if let Some(stderr) = child.stderr.take() {
            std::thread::spawn(move || {
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
                        eprintln!("[codex stderr] {}", line);
                    }
                }
            });
        }

        let mut reader = BufReader::new(stdout);
        let mut buffer = Vec::new();
        let mut emitted_session_end = false;

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
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            for event in Self::parse_event_line(trimmed) {
                if event.get("type") == Some(&Value::String("session_end".to_string())) {
                    emitted_session_end = true;
                }
                callback(event);
            }
        }

        let _ = child.wait();
        if !emitted_session_end {
            callback(Self::session_end_event());
        }
    }

    fn build_exec_command(codex_cmd: &str, message: &str) -> Command {
        let mut command = Command::new(codex_cmd);
        command
            .arg("exec")
            .arg("--json")
            .arg("--skip-git-repo-check")
            .arg("--dangerously-bypass-approvals-and-sandbox")
            .arg(message);
        command
    }

    fn build_resume_command(codex_cmd: &str, session_id: &str, message: &str) -> Command {
        let mut command = Command::new(codex_cmd);
        command
            .arg("exec")
            .arg("resume")
            .arg("--json")
            .arg("--skip-git-repo-check")
            .arg("--dangerously-bypass-approvals-and-sandbox")
            .arg(session_id)
            .arg(message);
        command
    }

    fn apply_common_settings(command: &mut Command, config: &Config) {
        command.stdout(Stdio::piped()).stderr(Stdio::piped());

        if let Some(ref work_dir) = config.work_dir {
            command.current_dir(work_dir);
        }

        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
    }

    fn spawn(mut command: Command, action: &str) -> Result<Child> {
        command
            .spawn()
            .map_err(|error| AppError::ProcessError(format!("{}失败: {}", action, error)))
    }

    fn parse_event_line(line: &str) -> Vec<Value> {
        let raw_event = match serde_json::from_str::<Value>(line) {
            Ok(event) => event,
            Err(error) => return vec![Self::error_event(&format!("Codex 事件解析失败: {}", error))],
        };

        let event_type = raw_event
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();

        match event_type {
            "thread.started" => Self::map_thread_started(&raw_event),
            "item.started" => Self::map_item_started(&raw_event),
            "item.delta" | "item.output.delta" => Self::map_item_delta(&raw_event),
            "item.completed" => Self::map_item_completed(&raw_event),
            "turn.completed" => vec![Self::session_end_event()],
            "turn.failed" | "thread.failed" | "error" => vec![Self::map_error(&raw_event)],
            _ => Vec::new(),
        }
    }

    fn map_thread_started(event: &Value) -> Vec<Value> {
        event.get("thread_id")
            .and_then(Value::as_str)
            .map(|thread_id| vec![json!({ "type": "session_start", "sessionId": thread_id })])
            .unwrap_or_default()
    }

    fn map_item_started(event: &Value) -> Vec<Value> {
        let item = match event.get("item") {
            Some(item) => item,
            None => return Vec::new(),
        };

        let item_type = item.get("type").and_then(Value::as_str).unwrap_or_default();
        if item_type != "command_execution" {
            return Vec::new();
        }

        let item_id = item.get("id").and_then(Value::as_str).unwrap_or_default();
        let command = item.get("command").and_then(Value::as_str).unwrap_or_default();

        if item_id.is_empty() {
            return Vec::new();
        }

        vec![json!({
            "type": "tool_start",
            "toolUseId": item_id,
            "toolName": TOOL_NAME_SHELL,
            "input": { "command": command }
        })]
    }

    fn map_item_completed(event: &Value) -> Vec<Value> {
        let item = match event.get("item") {
            Some(item) => item,
            None => return Vec::new(),
        };

        let item_type = item.get("type").and_then(Value::as_str).unwrap_or_default();
        match item_type {
            "agent_message" => Self::assistant_message_events(item),
            "command_execution" => Self::command_completion_events(item),
            _ => Vec::new(),
        }
    }

    fn assistant_message_events(item: &Value) -> Vec<Value> {
        let text = item.get("text").and_then(Value::as_str).unwrap_or_default();
        if text.is_empty() {
            return Vec::new();
        }

        vec![json!({
            "type": "assistant",
            "message": {
                "content": [
                    { "type": "text", "text": text }
                ]
            }
        })]
    }

    fn command_completion_events(item: &Value) -> Vec<Value> {
        let item_id = item.get("id").and_then(Value::as_str).unwrap_or_default();
        if item_id.is_empty() {
            return Vec::new();
        }

        let output = item
            .get("aggregated_output")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let success = item.get("exit_code").and_then(Value::as_i64).unwrap_or(1) == 0;

        vec![json!({
            "type": "tool_end",
            "toolUseId": item_id,
            "toolName": TOOL_NAME_SHELL,
            "output": output,
            "success": success
        })]
    }

    fn map_item_delta(event: &Value) -> Vec<Value> {
        let item = event.get("item").unwrap_or(event);
        let item_type = item.get("type").and_then(Value::as_str).unwrap_or_default();
        if item_type != "command_execution" {
            return Vec::new();
        }

        let item_id = Self::extract_item_id(event, item);
        if item_id.is_empty() {
            return Vec::new();
        }

        let Some(output) = Self::extract_delta_text(event, item) else {
            return Vec::new();
        };

        if output.is_empty() {
            return Vec::new();
        }

        vec![json!({
            "type": "tool_output",
            "toolUseId": item_id,
            "toolName": TOOL_NAME_SHELL,
            "output": output,
        })]
    }

    fn extract_item_id(event: &Value, item: &Value) -> String {
        let candidates = [
            item.get("id"),
            event.get("item_id"),
            event.get("itemId"),
            event.get("id"),
        ];

        for candidate in candidates {
            if let Some(value) = candidate.and_then(Value::as_str) {
                if !value.is_empty() {
                    return value.to_string();
                }
            }
        }

        String::new()
    }

    fn extract_delta_text(event: &Value, item: &Value) -> Option<String> {
        const POINTERS: &[&str] = &[
            "/delta/stdout",
            "/delta/stderr",
            "/delta/output_text",
            "/delta/text",
            "/delta/content",
            "/delta/log",
            "/delta/message",
            "/stdout",
            "/stderr",
            "/output_text",
            "/text",
            "/content",
        ];

        Self::find_string_by_pointers(event, POINTERS)
            .or_else(|| Self::find_string_by_pointers(item, POINTERS))
            .or_else(|| Self::find_string_in_delta(event))
            .or_else(|| Self::find_string_in_delta(item))
    }

    fn find_string_by_pointers(value: &Value, pointers: &[&str]) -> Option<String> {
        for pointer in pointers {
            if let Some(text) = value.pointer(pointer).and_then(Value::as_str) {
                if !text.is_empty() {
                    return Some(text.to_string());
                }
            }
        }
        None
    }

    fn find_string_in_delta(value: &Value) -> Option<String> {
        let delta = value.get("delta")?;
        if let Some(text) = delta.as_str() {
            if !text.is_empty() {
                return Some(text.to_string());
            }
            return None;
        }

        let obj = delta.as_object()?;
        for key in ["stdout", "stderr", "output_text", "text", "content", "log", "message"] {
            if let Some(text) = obj.get(key).and_then(Value::as_str) {
                if !text.is_empty() {
                    return Some(text.to_string());
                }
            }
        }
        None
    }

    fn map_error(event: &Value) -> Value {
        let message = event
            .get("message")
            .and_then(Value::as_str)
            .or_else(|| event.get("error").and_then(Value::as_str))
            .or_else(|| {
                event.get("error")
                    .and_then(|value| value.get("message"))
                    .and_then(Value::as_str)
            })
            .unwrap_or("Codex 执行失败");

        Self::error_event(message)
    }

    fn error_event(message: &str) -> Value {
        json!({ "type": "error", "error": message })
    }

    fn session_end_event() -> Value {
        json!({ "type": "session_end" })
    }
}
