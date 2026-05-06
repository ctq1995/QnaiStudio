use crate::commands::chat::utils::{emit_chat_event, remove_session_runtime};
use crate::error::{AppError, Result};
use crate::models::config::Config;
use crate::models::events::StreamEvent;
use crate::services::custom_cli_protocol::{CustomCliEventEnvelope, CustomCliRequest};
use crate::utils::encoding::decode_cli_line;
use crate::SessionRuntime;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct CustomCliService;

pub struct CustomCliSpawnResult {
    pub child: Child,
    pub stdin: ChildStdin,
}

pub struct CustomCliRequestBuilder {
    session_id: String,
    message: String,
    system_prompt: Option<String>,
}

impl CustomCliRequestBuilder {
    pub fn new(session_id: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            message: message.into(),
            system_prompt: None,
        }
    }

    pub fn system_prompt(mut self, system_prompt: Option<&str>) -> Self {
        self.system_prompt = system_prompt
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        self
    }

    pub fn build(self) -> CustomCliRequest {
        CustomCliRequest {
            session_id: self.session_id,
            message: self.message,
            system_prompt: self.system_prompt,
        }
    }
}

impl CustomCliService {
    pub fn initialize_request_builder(
        session_id: impl Into<String>,
        message: impl Into<String>,
    ) -> CustomCliRequestBuilder {
        CustomCliRequestBuilder::new(session_id, message)
    }

    pub fn start_request_builder(
        session_id: impl Into<String>,
        message: impl Into<String>,
    ) -> CustomCliRequestBuilder {
        Self::initialize_request_builder(session_id, message)
    }

    pub fn continue_request_builder(
        session_id: impl Into<String>,
        message: impl Into<String>,
    ) -> CustomCliRequestBuilder {
        CustomCliRequestBuilder::new(session_id, message)
    }

    pub fn spawn_custom_cli(config: &Config) -> Result<CustomCliSpawnResult> {
        let cli_path = config.get_custom_cli_cmd();
        let mut command = Command::new(&cli_path);
        command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());

        if let Some(ref work_dir) = config.work_dir {
            command.current_dir(work_dir);
        }

        if let Some(api_key) = config.custom_cli.api_key.as_deref().filter(|v| !v.is_empty()) {
            command.env("OPENAI_API_KEY", api_key);
        }
        if let Some(base_url) = config.custom_cli.base_url.as_deref().filter(|v| !v.is_empty()) {
            command.env("OPENAI_BASE_URL", base_url);
        }
        if let Some(model) = config.custom_cli.model.as_deref().filter(|v| !v.is_empty()) {
            command.env("OPENAI_MODEL", model);
        }

        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);

        let mut child = command
            .spawn()
            .map_err(|error| AppError::ProcessError(format!("启动 custom-cli 失败: {}", error)))?;

        let stdin = child.stdin.take().ok_or_else(|| {
            AppError::ProcessError("无法获取 custom-cli stdin".to_string())
        })?;

        Ok(CustomCliSpawnResult { child, stdin })
    }

    pub fn write_request(stdin: &mut ChildStdin, request: &CustomCliRequest) -> Result<()> {
        let payload = serde_json::to_string(request)
            .map_err(|error| AppError::Unknown(format!("序列化 custom-cli 请求失败: {}", error)))?;
        stdin.write_all(payload.as_bytes())
            .map_err(|error| AppError::ProcessError(format!("写入 custom-cli stdin 失败: {}", error)))?;
        stdin.write_all(b"\n")
            .map_err(|error| AppError::ProcessError(format!("写入 custom-cli 换行失败: {}", error)))?;
        stdin.flush()
            .map_err(|error| AppError::ProcessError(format!("flush custom-cli stdin 失败: {}", error)))
    }

    pub fn forward_stdout_events(
        child: Child,
        session_id: String,
        window: tauri::Window,
        sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>,
    ) {
        std::thread::spawn(move || {
            let mut child = child;
            let stdout = match child.stdout.take() {
                Some(stdout) => stdout,
                None => {
                    emit_chat_event(&window, error_event("无法获取 custom-cli stdout"), &session_id);
                    let _ = remove_session_runtime(&sessions, &session_id);
                    return;
                }
            };

            if let Some(stderr) = child.stderr.take() {
                spawn_stderr_reader(stderr);
            }

            let emitted_session_end = read_stdout_events(stdout, &window, &session_id);
            let _ = child.wait();
            if !emitted_session_end {
                emit_chat_event(&window, session_end_event(), &session_id);
            }
            let _ = remove_session_runtime(&sessions, &session_id);
        });
    }
}

fn spawn_stderr_reader(stderr: impl std::io::Read + Send + 'static) {
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
                eprintln!("[custom-cli stderr] {}", line);
            }
        }
    });
}

fn read_stdout_events(stdout: ChildStdout, window: &tauri::Window, session_id: &str) -> bool {
    let mut reader = BufReader::new(stdout);
    let mut buffer = Vec::new();
    let mut emitted_session_end = false;

    loop {
        buffer.clear();
        let bytes_read = match reader.read_until(b'\n', &mut buffer) {
            Ok(size) => size,
            Err(error) => {
                emit_chat_event(window, error_event(&format!("读取 custom-cli stdout 失败: {}", error)), session_id);
                break;
            }
        };
        if bytes_read == 0 {
            break;
        }

        let line = decode_cli_line(&buffer);
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let event = parse_custom_cli_event(trimmed);
        if event.get("type") == Some(&Value::String("session_end".to_string())) {
            emitted_session_end = true;
        }
        emit_chat_event(window, event, session_id);
    }

    emitted_session_end
}

fn parse_custom_cli_event(line: &str) -> Value {
    if let Ok(value) = serde_json::from_str::<Value>(line) {
        if let Some(event) = map_known_value(&value) {
            return event;
        }
        return value;
    }

    json!({
        "type": "text_delta",
        "text": line,
    })
}

fn map_known_value(value: &Value) -> Option<Value> {
    if let Ok(envelope) = serde_json::from_value::<CustomCliEventEnvelope>(value.clone()) {
        return Some(map_envelope_event(envelope));
    }

    if let Ok(stream_event) = serde_json::from_value::<StreamEvent>(value.clone()) {
        return serde_json::to_value(stream_event).ok();
    }

    None
}

fn map_envelope_event(envelope: CustomCliEventEnvelope) -> Value {
    match envelope.event.as_str() {
        "text_delta" => json!({
            "type": "text_delta",
            "text": envelope
                .data
                .as_ref()
                .and_then(|data| data.get("text"))
                .and_then(Value::as_str)
                .unwrap_or_default(),
        }),
        "session_end" => session_end_event(),
        "error" => {
            let message = envelope.error
                .map(|error| error.message)
                .or_else(|| envelope.data.and_then(|data| data.get("message").and_then(Value::as_str).map(ToOwned::to_owned)))
                .unwrap_or_else(|| "custom-cli 返回错误".to_string());
            error_event(&message)
        }
        _ => {
            if let Some(result) = envelope.result {
                if let Some(output) = result.output {
                    return json!({ "type": "text_delta", "text": output });
                }
            }
            envelope.data.unwrap_or_else(|| json!({ "type": envelope.event }))
        }
    }
}

fn error_event(message: &str) -> Value {
    json!({
        "type": "error",
        "error": message,
    })
}

fn session_end_event() -> Value {
    json!({
        "type": "session_end",
        "reason": "completed",
    })
}
