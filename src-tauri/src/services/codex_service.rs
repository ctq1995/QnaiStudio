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
        let mut command = Self::build_exec_command(&codex_cmd, message, config);
        Self::apply_common_settings(&mut command, config);
        Self::spawn(command, "启动 Codex 会话")
    }

    pub fn continue_chat(config: &Config, session_id: &str, message: &str) -> Result<Child> {
        let codex_cmd = config.get_codex_cmd();
        let mut command = Self::build_resume_command(&codex_cmd, session_id, message, config);
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

    fn build_exec_command(codex_cmd: &str, message: &str, config: &Config) -> Command {
        let mut command = Command::new(codex_cmd);
        command
            .arg("exec")
            .arg("--json")
            .arg("--skip-git-repo-check")
            .arg("--dangerously-bypass-approvals-and-sandbox");
        if let Some(ref model) = config.codex_cli.model {
            if !model.is_empty() {
                command.arg("--model").arg(model);
            }
        }
        command.arg(message);
        command
    }

    fn build_resume_command(codex_cmd: &str, session_id: &str, message: &str, config: &Config) -> Command {
        let mut command = Command::new(codex_cmd);
        command
            .arg("exec")
            .arg("resume")
            .arg("--json")
            .arg("--skip-git-repo-check")
            .arg("--dangerously-bypass-approvals-and-sandbox");
        if let Some(ref model) = config.codex_cli.model {
            if !model.is_empty() {
                command.arg("--model").arg(model);
            }
        }
        command
            .arg(session_id)
            .arg(message);
        command
    }

    fn apply_common_settings(command: &mut Command, config: &Config) {
        command.stdout(Stdio::piped()).stderr(Stdio::piped());

        if let Some(ref work_dir) = config.work_dir {
            command.current_dir(work_dir);
        }

        eprintln!("[CodexService] codex_cli config: api_key={:?}, base_url={:?}, model={:?}",
            config.codex_cli.api_key.as_deref().map(|k| if k.len() > 8 { &k[..8] } else { k }),
            config.codex_cli.base_url,
            config.codex_cli.model,
        );

        // Codex CLI 优先读取 ~/.codex/config.toml 和 auth.json，环境变量优先级较低。
        // 当 UI 配置了自定义值时，使用临时 CODEX_HOME 目录确保 UI 配置生效。
        let has_custom_config = config.codex_cli.api_key.as_ref().map_or(false, |k| !k.is_empty())
            || config.codex_cli.base_url.as_ref().map_or(false, |u| !u.is_empty());

        if has_custom_config {
            if let Ok(temp_home) = Self::create_temp_codex_home(config) {
                eprintln!("[CodexService] 使用临时 CODEX_HOME: {:?}", temp_home);
                command.env("CODEX_HOME", &temp_home);
            }
        }

        // 环境变量作为额外保障
        if let Some(ref api_key) = config.codex_cli.api_key {
            if !api_key.is_empty() {
                command.env_remove("OPENAI_API_KEY");
                command.env("OPENAI_API_KEY", api_key);
            }
        }
        if let Some(ref base_url) = config.codex_cli.base_url {
            if !base_url.is_empty() {
                command.env_remove("OPENAI_BASE_URL");
                command.env("OPENAI_BASE_URL", base_url);
            }
        }
        if let Some(ref model) = config.codex_cli.model {
            if !model.is_empty() {
                command.env_remove("OPENAI_MODEL");
                command.env("OPENAI_MODEL", model);
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

    /// 公开方法，供 test_engine_connection 使用
    pub fn create_temp_codex_home_for_test(config: &Config) -> Result<String> {
        Self::create_temp_codex_home(config)
    }

    /// 创建临时 CODEX_HOME 目录，包含 UI 配置的 auth.json 和 config.toml
    /// Codex CLI 优先读取 CODEX_HOME 下的配置文件，这样 UI 配置就能生效
    fn create_temp_codex_home(config: &Config) -> Result<String> {
        let temp_dir = std::env::temp_dir().join("qnai-codex-home");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| AppError::ProcessError(format!("创建临时目录失败: {}", e)))?;

        // 先复制用户原有的 config.toml 作为基础
        let user_codex_home = dirs::home_dir()
            .map(|h| h.join(".codex"));
        let user_config_path = user_codex_home.as_ref().map(|h| h.join("config.toml"));

        let mut base_config = String::new();
        if let Some(ref path) = user_config_path {
            if path.exists() {
                base_config = std::fs::read_to_string(path).unwrap_or_default();
            }
        }

        // 如果 UI 配置了 base_url，修改 config.toml 中的 model_providers 部分
        if let Some(ref base_url) = config.codex_cli.base_url {
            if !base_url.is_empty() {
                // 替换或追加 base_url 配置
                if base_config.contains("[model_providers.OpenAI]") {
                    // 替换已有的 base_url
                    let mut new_config = String::new();
                    for line in base_config.lines() {
                        if line.trim_start().starts_with("base_url") && new_config.contains("[model_providers.OpenAI]") {
                            new_config.push_str(&format!("base_url = \"{}\"\n", base_url));
                        } else {
                            new_config.push_str(line);
                            new_config.push('\n');
                        }
                    }
                    base_config = new_config;
                } else {
                    // 追加 provider 配置
                    base_config.push_str(&format!(
                        "\n[model_providers.OpenAI]\nname = \"OpenAI\"\nbase_url = \"{}\"\n",
                        base_url
                    ));
                }
            }
        }

        // 写入 config.toml
        let config_path = temp_dir.join("config.toml");
        std::fs::write(&config_path, &base_config)
            .map_err(|e| AppError::ProcessError(format!("写入 config.toml 失败: {}", e)))?;

        // 写入 auth.json
        let api_key = config.codex_cli.api_key.as_deref().unwrap_or("");
        if !api_key.is_empty() {
            let auth_json = format!("{{\"OPENAI_API_KEY\":\"{}\"}}", api_key);
            let auth_path = temp_dir.join("auth.json");
            std::fs::write(&auth_path, &auth_json)
                .map_err(|e| AppError::ProcessError(format!("写入 auth.json 失败: {}", e)))?;
        } else {
            // 没有自定义 API key，复制原有的 auth.json
            if let Some(ref home) = user_codex_home {
                let src = home.join("auth.json");
                if src.exists() {
                    let _ = std::fs::copy(&src, temp_dir.join("auth.json"));
                }
            }
        }

        // 复制 instructions.md（如果存在）
        if let Some(ref home) = user_codex_home {
            let src = home.join("instructions.md");
            if src.exists() {
                let _ = std::fs::copy(&src, temp_dir.join("instructions.md"));
            }
        }

        Ok(temp_dir.to_string_lossy().to_string())
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
