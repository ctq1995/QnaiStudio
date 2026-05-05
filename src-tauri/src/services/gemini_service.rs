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

pub struct GeminiService;

impl GeminiService {
    pub fn start_chat(config: &Config, message: &str) -> Result<Child> {
        let gemini_cmd = config.get_gemini_cmd();
        let mut command = Self::build_chat_command(&gemini_cmd, message, config);
        Self::apply_common_settings(&mut command, config);
        Self::spawn(command, "启动 Gemini 会话")
    }

    pub fn read_events<F>(mut child: Child, mut callback: F)
    where
        F: FnMut(Value) + Send + 'static,
    {
        let stdout = match child.stdout.take() {
            Some(stdout) => stdout,
            None => {
                callback(Self::error_event("无法获取 Gemini stdout"));
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
                        eprintln!("[gemini stderr] {}", line);
                    }
                }
            });
        }

        let mut reader = BufReader::new(stdout);
        let mut buffer = Vec::new();
        let mut emitted_session_end = false;
        let mut current_text = String::new();

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

            eprintln!("[gemini stdout] {}", &trimmed.chars().take(200).collect::<String>());

            for event in Self::parse_event_line(trimmed, &mut current_text) {
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

    fn build_chat_command(gemini_cmd: &str, message: &str, config: &Config) -> Command {
        let mut command = Command::new(gemini_cmd);
        command.arg("--prompt").arg(message).arg("--output_format").arg("json");

        // Advanced params
        let adv = config.gemini.advanced.as_ref();

        // approval-mode takes precedence over legacy --yolo flag when set
        if let Some(approval_mode) = adv.and_then(|a| a.approval_mode.as_ref()) {
            command.arg("--approval-mode").arg(approval_mode.as_str());
        } else {
            // Fallback to legacy yolo flag
            let yolo = adv.and_then(|a| a.yolo).unwrap_or(true);
            if yolo {
                command.arg("--yolo");
            }
        }

        if let Some(sandbox) = adv.and_then(|a| a.sandbox) {
            if sandbox {
                command.arg("--sandbox");
            }
        }

        if let Some(ref model) = config.gemini.model {
            if !model.is_empty() {
                command.arg("--model").arg(model);
            }
        }
        command
    }

    fn apply_common_settings(command: &mut Command, config: &Config) {
        command.stdout(Stdio::piped()).stderr(Stdio::piped());

        if let Some(ref work_dir) = config.work_dir {
            command.current_dir(work_dir);
        }

        eprintln!("[GeminiService] gemini config: api_key={:?}, base_url={:?}, model={:?}",
            config.resolve_gemini_api_key().map(|k| if k.len() > 8 { &k[..8] } else { k }),
            config.resolve_gemini_base_url(),
            config.gemini.model,
        );
        if let Some(api_key) = config.resolve_gemini_api_key() {
            command.env_remove("GEMINI_API_KEY");
            command.env_remove("GOOGLE_API_KEY");
            command.env("GEMINI_API_KEY", api_key);
            command.env("GOOGLE_API_KEY", api_key);
        }
        if let Some(base_url) = config.resolve_gemini_base_url() {
            command.env_remove("GEMINI_API_BASE_URL");
            command.env_remove("GEMINI_BASE_URL");
            command.env("GEMINI_API_BASE_URL", base_url);
            command.env("GEMINI_BASE_URL", base_url);
        }
        if let Some(ref model) = config.gemini.model {
            if !model.is_empty() {
                command.env_remove("GEMINI_MODEL");
                command.env("GEMINI_MODEL", model);
            }
        }

        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
    }

    fn spawn(mut command: Command, action: &str) -> Result<Child> {
        command
            .spawn()
            .map_err(|error| AppError::ProcessError(format!("{}失败: {}", action, error)))
    }

    /// 解析 Gemini CLI 输出行为统一事件格式
    ///
    /// Gemini CLI 可能输出多种格式：
    /// 1. JSON 流事件（`{"type": "...", ...}`）
    /// 2. 纯文本（最终回复文本）
    fn parse_event_line(line: &str, current_text: &mut String) -> Vec<Value> {
        // 尝试解析为 JSON
        if let Ok(raw_event) = serde_json::from_str::<Value>(line) {
            return Self::map_gemini_event(&raw_event, current_text);
        }

        // 纯文本行：累积为助手消息
        if !line.is_empty() {
            current_text.push_str(line);
            current_text.push('\n');
            return vec![json!({
                "type": "text_delta",
                "text": line
            })];
        }

        Vec::new()
    }

    fn map_gemini_event(event: &Value, current_text: &mut String) -> Vec<Value> {
        let event_type = event
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();

        match event_type {
            // 文本内容块
            "content" | "text" => {
                let text = event.get("text")
                    .or_else(|| event.get("content"))
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if text.is_empty() {
                    return Vec::new();
                }
                current_text.push_str(text);
                vec![json!({ "type": "text_delta", "text": text })]
            }

            // 工具调用开始
            "tool_call" | "tool_use" | "function_call" => {
                let tool_name = event.get("name")
                    .or_else(|| event.get("tool_name"))
                    .or_else(|| event.get("tool"))
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let tool_id = event.get("tool_id")
                    .or_else(|| event.get("tool_use_id"))
                    .or_else(|| event.get("toolUseId"))
                    .or_else(|| event.get("id"))
                    .and_then(Value::as_str)
                    .unwrap_or("gemini-tool");
                let input = event.get("args")
                    .or_else(|| event.get("input"))
                    .cloned()
                    .unwrap_or(json!({}));

                vec![
                    json!({ "type": "tool_start", "toolUseId": tool_id, "toolName": tool_name, "input": input }),
                ]
            }

            // 工具调用结果
            "tool_result" | "function_response" => {
                let tool_id = event.get("tool_id")
                    .or_else(|| event.get("tool_use_id"))
                    .or_else(|| event.get("toolUseId"))
                    .or_else(|| event.get("id"))
                    .or_else(|| event.get("call_id"))
                    .and_then(Value::as_str)
                    .unwrap_or("gemini-tool");
                let tool_name = event.get("name")
                    .or_else(|| event.get("tool_name"))
                    .or_else(|| event.get("tool"))
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                let output = event.get("response")
                    .or_else(|| event.get("output"))
                    .or_else(|| event.get("result"))
                    .map(|v| v.to_string());

                vec![
                    json!({ "type": "tool_end", "toolUseId": tool_id, "toolName": tool_name, "output": output }),
                ]
            }

            // 助手完整消息
            "assistant" | "message" => {
                let text = event.get("text")
                    .or_else(|| event.get("content"))
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if !text.is_empty() {
                    *current_text = text.to_string();
                    return vec![json!({
                        "type": "assistant",
                        "message": {
                            "content": [{"type": "text", "text": text}]
                        }
                    })];
                }
                Vec::new()
            }

            // 会话结束
            "done" | "end" | "finish" | "session_end" => {
                // 如果有积累的文本，先发送 assistant 消息
                let mut events = Vec::new();
                if !current_text.is_empty() {
                    let text = current_text.clone();
                    current_text.clear();
                    events.push(json!({
                        "type": "assistant",
                        "message": {
                            "content": [{"type": "text", "text": text}]
                        }
                    }));
                }
                events.push(Self::session_end_event());
                events
            }

            // 错误
            "error" => {
                let msg = event.get("message")
                    .or_else(|| event.get("error"))
                    .and_then(Value::as_str)
                    .unwrap_or("Gemini 错误");
                vec![Self::error_event(msg)]
            }

            _ => Vec::new(),
        }
    }

    fn error_event(message: &str) -> Value {
        json!({ "type": "error", "error": message })
    }

    fn session_end_event() -> Value {
        json!({ "type": "session_end" })
    }
}
