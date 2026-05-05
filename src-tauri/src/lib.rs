mod error;
mod models;
mod services;
mod commands;
mod utils;

use error::Result;
use tauri::Manager;
use models::config::{Config, HealthStatus};
use services::config_store::ConfigStore;
use commands::chat::{start_chat, continue_chat, interrupt_chat, respond_permission};
use commands::chat::{
    list_iflow_sessions, get_iflow_session_history,
    get_iflow_file_contexts, get_iflow_token_stats,
    list_claude_code_sessions, get_claude_code_session_history,
};
use commands::{append_ai_log, validate_workspace_path, get_directory_info};
use commands::window::{
    show_floating_window, show_main_window, toggle_floating_window,
    is_floating_window_visible, set_floating_window_position, get_floating_window_position
};
use commands::file_explorer::{
    read_directory, get_file_content, create_file, create_directory,
    delete_file, rename_file, path_exists, read_commands, search_files
};
use commands::versioning::{
    list_workspace_versions, create_workspace_version, check_restore_workspace_version,
    restore_workspace_version, delete_workspace_version,
};
use commands::logging::{
    get_log_dir, read_logs, clear_logs, open_log_dir,
};
use commands::context::{
    context_upsert, context_upsert_many, context_query, context_get_all,
    context_remove, context_clear,
    ide_report_current_file, ide_report_file_structure, ide_report_diagnostics,
    ContextMemoryStore,
};
use commands::models::fetch_models;
use commands::chat::session::{build_claude_command, ClaudeCommandArgs, ClaudeOutputMode};

use std::sync::{Arc, Mutex};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
pub struct SessionRuntime {
    pub canonical_id: String,
    pub pid: u32,
    pub aliases: HashSet<String>,
}

/// 全局配置状态
pub struct AppState {
    pub config_store: Mutex<ConfigStore>,
    /// 保存会话运行态，支持 canonical id + alias 解析，而不只是裸 PID。
    pub sessions: Arc<Mutex<HashMap<String, SessionRuntime>>>,
    /// 保存会话进程的 stdin handle，用于权限交互时向 CLI 写入批准/拒绝
    pub stdin_handles: Arc<Mutex<HashMap<String, std::process::ChildStdin>>>,
    /// 上下文存储
    pub context_store: Arc<Mutex<ContextMemoryStore>>,
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// 获取配置
#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> Result<Config> {
    let store = state.config_store.lock()
        .map_err(|e| error::AppError::Unknown(e.to_string()))?;
    Ok(store.get().clone())
}

/// 更新配置
#[tauri::command]
fn update_config(config: Config, state: tauri::State<AppState>) -> Result<()> {
    let mut store = state.config_store.lock()
        .map_err(|e| error::AppError::Unknown(e.to_string()))?;
    store.update(config)
}

/// 设置工作目录
#[tauri::command]
fn set_work_dir(path: Option<String>, state: tauri::State<AppState>) -> Result<()> {
    let mut store = state.config_store.lock()
        .map_err(|e| error::AppError::Unknown(e.to_string()))?;
    let mut config = store.get().clone();
    config.work_dir = path.map(Into::into);
    store.update(config)
}

/// 设置 Claude 命令路径
#[tauri::command]
fn set_claude_cmd(cmd: String, state: tauri::State<AppState>) -> Result<()> {
    let mut store = state.config_store.lock()
        .map_err(|e| error::AppError::Unknown(e.to_string()))?;
    let mut config = store.get().clone();
    config.claude_code.cli_path = cmd.clone();
    config.claude_cmd = Some(cmd);
    store.update(config)
}

/// 设置 Codex 命令路径
#[tauri::command]
fn set_codex_cmd(cmd: String, state: tauri::State<AppState>) -> Result<()> {
    let mut store = state.config_store.lock()
        .map_err(|e| error::AppError::Unknown(e.to_string()))?;
    let mut config = store.get().clone();
    config.codex_cli.cli_path = cmd;
    store.update(config)
}

/// 设置 IFlow 命令路径
#[tauri::command]
fn set_iflow_cmd(cmd: String, state: tauri::State<AppState>) -> Result<()> {
    let mut store = state.config_store.lock()
        .map_err(|e| error::AppError::Unknown(e.to_string()))?;
    let mut config = store.get().clone();
    config.iflow.cli_path = if cmd.trim().is_empty() { None } else { Some(cmd) };
    store.update(config)
}

/// 设置 Gemini 命令路径
#[tauri::command]
fn set_gemini_cmd(cmd: String, state: tauri::State<AppState>) -> Result<()> {
    let mut store = state.config_store.lock()
        .map_err(|e| error::AppError::Unknown(e.to_string()))?;
    let mut config = store.get().clone();
    config.gemini.cli_path = cmd;
    store.update(config)
}

/// 查找所有可用的 Claude CLI 路径
#[tauri::command]
fn find_claude_paths() -> Vec<String> {
    ConfigStore::find_claude_paths()
}

/// 路径验证结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathValidationResult {
    /// 路径是否有效
    pub valid: bool,
    /// 错误信息
    pub error: Option<String>,
    /// Claude 版本
    pub version: Option<String>,
}

/// 验证 Claude CLI 路径
#[tauri::command]
fn validate_claude_path(path: String) -> PathValidationResult {
    match ConfigStore::validate_claude_path(path) {
        Ok((valid, error, version)) => PathValidationResult {
            valid,
            error,
            version,
        },
        Err(_) => PathValidationResult {
            valid: false,
            error: Some("验证过程中发生错误".to_string()),
            version: None,
        },
    }
}

/// 查找所有可用的 Codex CLI 路径
#[tauri::command]
fn find_codex_paths() -> Vec<String> {
    ConfigStore::find_codex_paths()
}

/// 查找所有可用的 Gemini CLI 路径
#[tauri::command]
fn find_gemini_paths() -> Vec<String> {
    ConfigStore::find_gemini_paths()
}

/// 验证 Gemini CLI 路径
#[tauri::command]
fn validate_gemini_path(path: String) -> PathValidationResult {
    match ConfigStore::validate_gemini_path(path) {
        Ok((valid, error, version)) => PathValidationResult { valid, error, version },
        Err(_) => PathValidationResult {
            valid: false,
            error: Some("验证过程中发生错误".to_string()),
            version: None,
        },
    }
}

/// 验证 Codex CLI 路径
#[tauri::command]
fn validate_codex_path(path: String) -> PathValidationResult {
    match ConfigStore::validate_codex_path(path) {
        Ok((valid, error, version)) => PathValidationResult {
            valid,
            error,
            version,
        },
        Err(_) => PathValidationResult {
            valid: false,
            error: Some("验证过程中发生错误".to_string()),
            version: None,
        },
    }
}

/// 查找所有可用的 IFlow CLI 路径
#[tauri::command]
fn find_iflow_paths() -> Vec<String> {
    ConfigStore::find_iflow_paths()
}

/// 验证 IFlow CLI 路径
#[tauri::command]
fn validate_iflow_path(path: String) -> PathValidationResult {
    match ConfigStore::validate_iflow_path(path) {
        Ok((valid, error, version)) => PathValidationResult {
            valid,
            error,
            version,
        },
        Err(_) => PathValidationResult {
            valid: false,
            error: Some("验证过程中发生错误".to_string()),
            version: None,
        },
    }
}


/// 健康检查（异步，不阻塞 UI 线程）
#[tauri::command]
async fn health_check(state: tauri::State<'_, AppState>) -> Result<HealthStatus> {
    let config = {
        let store = state.config_store.lock()
            .unwrap_or_else(|e| e.into_inner());
        store.get().clone()
    };
    tokio::task::spawn_blocking(move || {
        ConfigStore::health_status_for_config(&config)
    })
    .await
    .map_err(|e| error::AppError::Unknown(e.to_string()))?
}

/// 检测 Claude CLI
#[tauri::command]
fn detect_claude(state: tauri::State<AppState>) -> Option<String> {
    let store = state.config_store.lock()
        .unwrap_or_else(|e| e.into_inner());
    store.detect_claude()
}

/// 测试引擎连接
/// 临时应用传入的配置，启动 CLI 发送一个最小 prompt，检查是否能正常响应
#[tauri::command]
async fn test_engine_connection(
    config: Config,
    engine_id: String,
) -> std::result::Result<TestConnectionResult, String> {
    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader};
    use std::time::{Duration, Instant};

    #[cfg(windows)]
    use std::os::windows::process::CommandExt;
    #[cfg(windows)]
    const CREATE_NO_WINDOW_FLAG: u32 = 0x08000000;

    let engine = models::config::EngineId::from_str(&engine_id)
        .ok_or_else(|| format!("未知引擎: {}", engine_id))?;

    let test_message = "Say exactly: CONNECTION_OK";
    let timeout = Duration::from_secs(30);

    let mut cmd = match engine {
        models::config::EngineId::ClaudeCode => {
            build_claude_command(ClaudeCommandArgs {
                config: &config,
                message: test_message,
                system_prompt: None,
                resume_session_id: None,
                output_mode: ClaudeOutputMode::Text { max_turns: Some(1) },
            }).map_err(|e| format!("构造 Claude 命令失败: {}", e))?
        }
        models::config::EngineId::CodexCli => {
            let codex_cmd = config.get_codex_cmd();
            let mut c = Command::new(&codex_cmd);
            c.arg("exec")
                .arg("--json")
                .arg("--skip-git-repo-check")
                .arg("--dangerously-bypass-approvals-and-sandbox")
                .arg(test_message);
            // Codex CLI 优先读取 config.toml/auth.json，需要用临时 CODEX_HOME 覆盖
            let has_custom = config.resolve_codex_api_key().is_some()
                || config.resolve_codex_base_url().is_some();
            if has_custom {
                if let Ok(temp_home) = services::codex_service::CodexService::create_temp_codex_home_for_test(&config) {
                    c.env("CODEX_HOME", &temp_home);
                }
            }
            if let Some(api_key) = config.resolve_codex_api_key() {
                c.env_remove("OPENAI_API_KEY");
                c.env("OPENAI_API_KEY", api_key);
            }
            if let Some(base_url) = config.resolve_codex_base_url() {
                c.env_remove("OPENAI_BASE_URL");
                c.env("OPENAI_BASE_URL", base_url);
            }
            if let Some(ref model) = config.codex_cli.model {
                if !model.is_empty() {
                    c.env_remove("OPENAI_MODEL");
                    c.env("OPENAI_MODEL", model);
                    c.arg("--model").arg(model);
                }
            }
            c
        }
        models::config::EngineId::Gemini => {
            let gemini_cmd = config.get_gemini_cmd();
            let mut c = Command::new(&gemini_cmd);
            c.arg("--prompt").arg(test_message);
            if let Some(api_key) = config.resolve_gemini_api_key() {
                c.env("GEMINI_API_KEY", api_key);
                c.env("GOOGLE_API_KEY", api_key);
            }
            if let Some(base_url) = config.resolve_gemini_base_url() {
                c.env("GEMINI_BASE_URL", base_url);
                c.env("GEMINI_API_BASE_URL", base_url);
            }
            if let Some(ref model) = config.gemini.model {
                if !model.is_empty() { c.env("GEMINI_MODEL", model); }
            }
            c
        }
        models::config::EngineId::IFlow => {
            let iflow_cmd = config.iflow.cli_path.as_deref().unwrap_or("iflow");
            let mut c = Command::new(iflow_cmd);
            c.arg("--yolo").arg("--prompt").arg(test_message);
            if let Some(api_key) = config.resolve_iflow_api_key() {
                c.env("IFLOW_API_KEY", api_key);
            }
            if let Some(base_url) = config.resolve_iflow_base_url() {
                c.env("IFLOW_BASE_URL", base_url);
            }
            if let Some(ref model) = config.iflow.model {
                if !model.is_empty() { c.env("IFLOW_MODEL", model); }
            }
            c
        }
        models::config::EngineId::CustomCli => {
            let custom_cli_cmd = config.get_custom_cli_cmd();
            let mut c = Command::new(&custom_cli_cmd);
            c.arg("--version");
            c
        }
    };

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW_FLAG);

    let mut child = cmd.spawn().map_err(|e| format!("启动 CLI 失败: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let start = Instant::now();
    let mut output_lines = Vec::new();
    let mut error_lines = Vec::new();
    let mut timed_out = false;

    let stdout_handle = stdout.map(|so| {
        std::thread::spawn(move || {
            let reader = BufReader::new(so);
            let mut lines = Vec::new();
            for line in reader.lines() {
                match line {
                    Ok(l) => lines.push(l),
                    Err(_) => break,
                }
            }
            lines
        })
    });

    let stderr_handle = stderr.map(|se| {
        std::thread::spawn(move || {
            let reader = BufReader::new(se);
            let mut lines = Vec::new();
            for line in reader.lines() {
                match line {
                    Ok(l) => lines.push(l),
                    Err(_) => break,
                }
            }
            lines
        })
    });

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => break,
            Ok(None) => {
                if start.elapsed() >= timeout {
                    timed_out = true;
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => return Err(format!("等待 CLI 进程状态失败: {}", e)),
        }
    }

    if let Some(handle) = stdout_handle {
        if let Ok(lines) = handle.join() {
            output_lines = lines;
        }
    }

    if let Some(handle) = stderr_handle {
        if let Ok(lines) = handle.join() {
            error_lines = lines;
        }
    }

    let stdout_text = output_lines.join("\n");
    let stderr_text = error_lines.join("\n");
    let all_output = format!("{}\n{}", stdout_text, stderr_text);

    // 判断结果
    let has_output = !stdout_text.trim().is_empty();
    let has_error_keywords = all_output.contains("error")
        || all_output.contains("Error")
        || all_output.contains("unauthorized")
        || all_output.contains("Unauthorized")
        || all_output.contains("invalid")
        || all_output.contains("Invalid")
        || all_output.contains("denied")
        || all_output.contains("refused")
        || all_output.contains("ECONNREFUSED")
        || all_output.contains("ENOTFOUND")
        || all_output.contains("timeout")
        || all_output.contains("401")
        || all_output.contains("403")
        || all_output.contains("404")
        || all_output.contains("429")
        || all_output.contains("500");

    let success = has_output && !has_error_keywords;

    let message = if success {
        "连接成功，引擎响应正常".to_string()
    } else if timed_out {
        format!("连接超时（{} 秒），CLI 未正常结束。\n{}", timeout.as_secs(), all_output.chars().take(500).collect::<String>())
    } else if !has_output && !stderr_text.trim().is_empty() {
        format!("连接失败:\n{}", stderr_text.chars().take(500).collect::<String>())
    } else if has_error_keywords {
        format!("连接异常:\n{}", all_output.chars().take(500).collect::<String>())
    } else {
        "未收到引擎响应，请检查配置".to_string()
    };

    Ok(TestConnectionResult { success, message })
}

#[derive(serde::Serialize)]
struct TestConnectionResult {
    success: bool,
    message: String,
}

// ============================================================================
// Tauri App Builder
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 默认不启用日志系统
    // let _logger_guard = Logger::init(false);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 在 setup 钩子中初始化 AppState，此时 Tauri 运行时已就绪
            // ConfigStore::new() 只做文件系统操作（快速路径），不会阻塞窗口显示
            let config_store = ConfigStore::new()
                .expect("无法初始化配置存储");

            app.manage(AppState {
                config_store: Mutex::new(config_store),
                sessions: Arc::new(Mutex::new(HashMap::new())),
                stdin_handles: Arc::new(Mutex::new(HashMap::new())),
                context_store: Arc::new(Mutex::new(ContextMemoryStore::new())),
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // 配置相关
            get_config,
            update_config,
            set_work_dir,
            set_claude_cmd,
            set_codex_cmd,
            set_iflow_cmd,
            set_gemini_cmd,
            find_claude_paths,
            validate_claude_path,
            find_codex_paths,
            validate_codex_path,
            find_gemini_paths,
            validate_gemini_path,
            find_iflow_paths,
            validate_iflow_path,
            // 健康检查
            health_check,
            detect_claude,
            test_engine_connection,
            fetch_models,
            // 聊天相关（统一接口）
            start_chat,
            continue_chat,
            interrupt_chat,
            respond_permission,
            // IFlow 会话历史相关
            list_iflow_sessions,
            get_iflow_session_history,
            get_iflow_file_contexts,
            get_iflow_token_stats,
            // Claude Code 原生会话历史相关
            list_claude_code_sessions,
            get_claude_code_session_history,
            // 工作区相关
            validate_workspace_path,
            get_directory_info,
            // 文件浏览器相关
            read_directory,
            get_file_content,
            create_file,
            create_directory,
            delete_file,
            rename_file,
            path_exists,
            read_commands,
            search_files,
            // 工作区版本管理
            list_workspace_versions,
            create_workspace_version,
            check_restore_workspace_version,
            restore_workspace_version,
            delete_workspace_version,
            // 日志管理
            get_log_dir,
            read_logs,
            clear_logs,
            open_log_dir,
            // AI raw logging
            append_ai_log,
            // 窗口管理相关
            show_floating_window,
            show_main_window,
            toggle_floating_window,
            is_floating_window_visible,
            set_floating_window_position,
            get_floating_window_position,
            // 上下文管理相关
            context_upsert,
            context_upsert_many,
            context_query,
            context_get_all,
            context_remove,
            context_clear,
            ide_report_current_file,
            ide_report_file_structure,
            ide_report_diagnostics,

        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
