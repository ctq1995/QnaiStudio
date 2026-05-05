use crate::error::{AppError, Result};
use crate::models::config::Config;
use crate::models::events::StreamEvent;
use crate::utils::encoding::{decode_cli_line, decode_cli_output};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use uuid::Uuid;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const LOG_PREVIEW_CHARS: usize = 100;
const LOG_ERROR_PREVIEW_CHARS: usize = 200;

pub struct ChatSession {
    pub id: String,
    pub child: Child,
}

impl ChatSession {
    pub fn with_id_and_child(id: String, child: Child) -> Self {
        Self { id, child }
    }

    pub fn start(params: ClaudeStartParams<'_>) -> Result<Self> {
        let mut cmd = build_claude_command(ClaudeCommandArgs {
            config: params.config,
            message: params.message,
            system_prompt: params.system_prompt,
            resume_session_id: None,
            output_mode: ClaudeOutputMode::StreamJson,
        })?;

        let session_id = params.session_id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let child = cmd.spawn()
            .map_err(|e| AppError::ProcessError(format!("启动 Claude 失败: {}", e)))?;

        Ok(Self { id: session_id, child })
    }

    pub fn read_events<F>(self, mut callback: F)
    where
        F: FnMut(StreamEvent) + Send + 'static,
    {
        let stdout = match self.child.stdout {
            Some(stdout) => stdout,
            None => {
                callback(StreamEvent::Error { error: "无法获取进程输出流".to_string() });
                return;
            }
        };

        let stderr = match self.child.stderr {
            Some(stderr) => stderr,
            None => {
                callback(StreamEvent::Error { error: "无法获取进程错误流".to_string() });
                return;
            }
        };

        spawn_stderr_reader(stderr);
        let summary = read_stdout_events(stdout, &mut callback);
        if !summary.received_session_end {
            callback(StreamEvent::SessionEnd {
                reason: "completed".to_string(),
            });
        }
    }
}

pub struct ClaudeStartParams<'a> {
    pub config: &'a Config,
    pub message: &'a str,
    pub system_prompt: Option<&'a str>,
    pub session_id: Option<String>,
}

pub enum ClaudeOutputMode {
    StreamJson,
    Text { max_turns: Option<u32> },
}

pub struct ClaudeCommandArgs<'a> {
    pub config: &'a Config,
    pub message: &'a str,
    pub system_prompt: Option<&'a str>,
    pub resume_session_id: Option<&'a str>,
    pub output_mode: ClaudeOutputMode,
}

pub fn build_claude_command(args: ClaudeCommandArgs<'_>) -> Result<Command> {
    log_claude_launch_context(&args);
    let mut cmd = build_platform_command(&args)?;
    apply_io_settings(&mut cmd);
    apply_work_dir(&mut cmd, args.config);
    apply_git_bash_env(&mut cmd, args.config);
    apply_engine_env(&mut cmd, args.config);
    apply_platform_flags(&mut cmd);
    Ok(cmd)
}

fn spawn_stderr_reader(stderr: ChildStderr) {
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
                eprintln!("[stderr] {}", line);
            }
        }
    });
}

fn read_stdout_events<F>(stdout: ChildStdout, callback: &mut F) -> ReadSummary
where
    F: FnMut(StreamEvent),
{
    let mut reader = BufReader::new(stdout);
    let mut buffer = Vec::new();
    let mut summary = ReadSummary::default();

    loop {
        buffer.clear();
        let bytes_read = match reader.read_until(b'\n', &mut buffer) {
            Ok(size) => size,
            Err(e) => {
                eprintln!("[ChatSession::read_events] 读取失败: {}", e);
                break;
            }
        };
        if bytes_read == 0 {
            break;
        }

        let line = decode_cli_line(&buffer);
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }

        summary.line_count += 1;
        eprintln!(
            "[ChatSession::read_events] 行 {}: {}",
            summary.line_count,
            line_trimmed.chars().take(LOG_PREVIEW_CHARS).collect::<String>()
        );

        if let Some(event) = StreamEvent::parse_line(line_trimmed) {
            if matches!(event, StreamEvent::SessionEnd { .. }) {
                summary.received_session_end = true;
            }
            callback(event);
        } else {
            eprintln!(
                "[ChatSession::read_events] 解析失败: {}",
                line_trimmed.chars().take(LOG_ERROR_PREVIEW_CHARS).collect::<String>()
            );
        }
    }

    summary
}

#[derive(Default)]
struct ReadSummary {
    line_count: usize,
    received_session_end: bool,
}

fn build_platform_command(args: &ClaudeCommandArgs<'_>) -> Result<Command> {
    #[cfg(windows)]
    {
        let claude_cmd = args.config.get_claude_cmd();
        let launcher = resolve_windows_claude_launcher(&claude_cmd)?;
        Ok(build_windows_command(&launcher, args))
    }

    #[cfg(not(windows))]
    {
        Ok(build_direct_command(args))
    }
}

#[cfg(windows)]
enum WindowsClaudeLauncher {
    DirectExe(String),
    NodeCli { node_exe: String, cli_js: String },
}

#[cfg(windows)]
fn resolve_windows_claude_launcher(claude_cmd_path: &str) -> Result<WindowsClaudeLauncher> {
    let resolved_cli = resolve_windows_claude_cmd_path(claude_cmd_path)?;
    let cmd_path = Path::new(&resolved_cli);
    let npm_dir = cmd_path.parent()
        .ok_or_else(|| AppError::ProcessError("无法获取 Claude CLI 启动器的父目录".to_string()))?;

    if let Some(claude_exe) = find_claude_exe(npm_dir) {
        return Ok(WindowsClaudeLauncher::DirectExe(claude_exe));
    }

    let node_exe = find_node_exe(npm_dir)?;
    let cli_js = find_cli_js(npm_dir)?;
    Ok(WindowsClaudeLauncher::NodeCli { node_exe, cli_js })
}

#[cfg(windows)]
fn resolve_windows_claude_cmd_path(claude_cmd_path: &str) -> Result<String> {
    let trimmed = claude_cmd_path.trim();
    if trimmed.is_empty() {
        return Err(AppError::ProcessError("Claude CLI 路径为空".to_string()));
    }

    if let Some(normalized) = normalize_windows_command_path(trimmed.to_string()) {
        return Ok(normalized);
    }

    let ps_command = format!(
        "Get-Command {} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source",
        trimmed
    );
    if let Ok(output) = Command::new("powershell")
        .args(["-Command", &ps_command])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        if output.status.success() {
            let path = decode_cli_output(&output.stdout).trim().to_string();
            if let Some(normalized) = normalize_windows_command_path(path) {
                return Ok(normalized);
            }
        }
    }

    if let Ok(output) = Command::new("where")
        .arg(trimmed)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        if output.status.success() {
            if let Some(path) = decode_cli_output(&output.stdout).lines().next() {
                if let Some(normalized) = normalize_windows_command_path(path.trim().to_string()) {
                    return Ok(normalized);
                }
            }
        }
    }

    Err(AppError::ProcessError(format!(
        "无法解析 Claude CLI 路径: {}",
        claude_cmd_path
    )))
}

#[cfg(windows)]
fn normalize_windows_command_path(path: String) -> Option<String> {
    if path.is_empty() {
        return None;
    }

    if path.ends_with(".ps1") {
        let cmd_path = path.replace(".ps1", ".cmd");
        if Path::new(&cmd_path).exists() {
            return Some(cmd_path);
        }
    }

    if Path::new(&path).exists() {
        return Some(path);
    }

    let cmd_path = format!("{}.cmd", path);
    if Path::new(&cmd_path).exists() {
        return Some(cmd_path);
    }

    None
}

#[cfg(windows)]
fn find_claude_exe(npm_dir: &Path) -> Option<String> {
    let local_exe = npm_dir
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-code")
        .join("bin")
        .join("claude.exe");

    if local_exe.exists() {
        return Some(local_exe.to_string_lossy().to_string());
    }

    if let Some(roaming_appdata) = std::env::var("APPDATA").ok() {
        let global_exe = PathBuf::from(roaming_appdata)
            .join("npm")
            .join("node_modules")
            .join("@anthropic-ai")
            .join("claude-code")
            .join("bin")
            .join("claude.exe");

        if global_exe.exists() {
            return Some(global_exe.to_string_lossy().to_string());
        }
    }

    None
}

#[cfg(windows)]
fn find_node_exe(npm_dir: &Path) -> Result<String> {
    let local_node = npm_dir.join("node.exe");
    if local_node.exists() {
        return Ok(local_node.to_string_lossy().to_string());
    }

    let output = Command::new("where")
        .args(["node"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| AppError::ProcessError(format!("查找 node.exe 失败: {}", e)))?;

    if output.status.success() {
        if let Some(path) = decode_cli_output(&output.stdout).lines().next() {
            return Ok(path.trim().to_string());
        }
    }

    const COMMON_NODE_PATHS: [&str; 2] = [
        r"C:\Program Files\nodejs\node.exe",
        r"C:\Program Files (x86)\nodejs\node.exe",
    ];

    for path in COMMON_NODE_PATHS {
        if Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    Err(AppError::ProcessError("无法找到 node.exe".to_string()))
}

#[cfg(windows)]
fn find_cli_js(npm_dir: &Path) -> Result<String> {
    let cli_js = npm_dir
        .join("node_modules")
        .join("@anthropic-ai")
        .join("claude-code")
        .join("cli.js");

    if cli_js.exists() {
        return Ok(cli_js.to_string_lossy().to_string());
    }

    if let Some(roaming_appdata) = std::env::var("APPDATA").ok() {
        let global_cli = PathBuf::from(roaming_appdata)
            .join("npm")
            .join("node_modules")
            .join("@anthropic-ai")
            .join("claude-code")
            .join("cli.js");

        if global_cli.exists() {
            return Ok(global_cli.to_string_lossy().to_string());
        }
    }

    Err(AppError::ProcessError(format!(
        "无法找到 cli.js，预期位置: {}",
        cli_js.display()
    )))
}

#[cfg(windows)]
fn build_windows_command(launcher: &WindowsClaudeLauncher, args: &ClaudeCommandArgs<'_>) -> Command {
    match launcher {
        WindowsClaudeLauncher::DirectExe(claude_exe) => {
            let mut cmd = Command::new(claude_exe);
            apply_resume_arg(&mut cmd, args.resume_session_id);
            apply_system_prompt(&mut cmd, args.system_prompt);
            apply_model_arg(&mut cmd, args.config);
            apply_output_args(&mut cmd, &args.output_mode, args.message, args.config);
            cmd
        }
        WindowsClaudeLauncher::NodeCli { node_exe, cli_js } => {
            let mut cmd = Command::new(node_exe);
            cmd.arg(cli_js);
            apply_resume_arg(&mut cmd, args.resume_session_id);
            apply_system_prompt(&mut cmd, args.system_prompt);
            apply_model_arg(&mut cmd, args.config);
            apply_output_args(&mut cmd, &args.output_mode, args.message, args.config);
            cmd
        }
    }
}

#[cfg(not(windows))]
fn build_direct_command(args: &ClaudeCommandArgs<'_>) -> Command {
    let claude_cmd = args.config.get_claude_cmd();
    let mut cmd = Command::new(&claude_cmd);
    apply_resume_arg(&mut cmd, args.resume_session_id);
    apply_system_prompt(&mut cmd, args.system_prompt);
    apply_model_arg(&mut cmd, args.config);
    apply_output_args(&mut cmd, &args.output_mode, args.message, args.config);
    cmd
}

fn log_claude_launch_context(args: &ClaudeCommandArgs<'_>) {
    let cli_path = args.config.get_claude_cmd();
    let work_dir = args.config.work_dir.as_ref().map(|p| p.to_string_lossy().to_string());
    let git_bash = args.config.git_bin_path.as_deref().filter(|v| !v.is_empty());
    let api_key = args.config.resolve_claude_api_key();
    let base_url = args.config.resolve_claude_base_url();
    let model = args.config.claude_code.model.as_deref().filter(|v| !v.is_empty());

    eprintln!(
        "[ClaudeLaunch] cliPath={}, outputMode={}, resume={}, systemPrompt={}, workDir={}, gitBashPath={}",
        cli_path,
        describe_output_mode(&args.output_mode),
        args.resume_session_id.is_some(),
        args.system_prompt.map(|v| !v.is_empty()).unwrap_or(false),
        work_dir.as_deref().unwrap_or("<none>"),
        git_bash.unwrap_or("<none>"),
    );

    eprintln!(
        "[ClaudeLaunch] uiConfig apiKeyInjected={}, apiKeyPreview={}, baseUrlInjected={}, baseUrl={}, modelInjected={}, model={}",
        api_key.is_some(),
        mask_secret(api_key),
        base_url.is_some(),
        base_url.unwrap_or("<none>"),
        model.is_some(),
        model.unwrap_or("<none>"),
    );
}

fn describe_output_mode(output_mode: &ClaudeOutputMode) -> String {
    match output_mode {
        ClaudeOutputMode::StreamJson => "stream-json".to_string(),
        ClaudeOutputMode::Text { max_turns } => match max_turns {
            Some(turns) => format!("text(max_turns={})", turns),
            None => "text".to_string(),
        },
    }
}

fn mask_secret(value: Option<&str>) -> String {
    match value {
        Some(secret) if !secret.is_empty() => {
            let prefix: String = secret.chars().take(6).collect();
            format!("{}***", prefix)
        }
        _ => "<none>".to_string(),
    }
}

fn apply_resume_arg(cmd: &mut Command, session_id: Option<&str>) {
    if let Some(id) = session_id {
        cmd.arg("--resume").arg(id);
    }
}

fn apply_system_prompt(cmd: &mut Command, system_prompt: Option<&str>) {
    if let Some(prompt) = system_prompt {
        if !prompt.is_empty() {
            cmd.arg("--system-prompt").arg(prompt);
        }
    }
}

fn apply_output_args(cmd: &mut Command, output_mode: &ClaudeOutputMode, message: &str, config: &Config) {
    // Resolve advanced params from config; fall back to defaults
    let adv = config.claude_code.advanced.as_ref();

    let permission_mode = adv
        .and_then(|a| a.permission_mode.as_ref())
        .map(|m| m.as_str())
        .unwrap_or("bypassPermissions");

    let verbose = adv
        .and_then(|a| a.verbose)
        .unwrap_or(true);

    let system_prompt = adv
        .and_then(|a| a.system_prompt.as_ref())
        .filter(|s| !s.is_empty());

    let append_system_prompt = adv
        .and_then(|a| a.append_system_prompt.as_ref())
        .filter(|s| !s.is_empty());

    let output_format = adv
        .and_then(|a| a.output_format.as_ref())
        .filter(|s| !s.is_empty());

    // Apply system prompt from advanced config (takes precedence over runtime arg)
    if system_prompt.is_some() {
        apply_system_prompt(cmd, system_prompt.map(|s| s.as_str()));
    }

    // Apply append-system-prompt
    if let Some(append) = append_system_prompt {
        cmd.arg("--append-system-prompt").arg(append);
    }

    match output_mode {
        ClaudeOutputMode::StreamJson => {
            cmd.arg("--print");
            if verbose {
                cmd.arg("--verbose");
            }
            // Advanced config output_format overrides the hardcoded default
            let fmt = output_format.map_or("stream-json", |v| v.as_str());
            cmd.arg("--output-format")
                .arg(fmt)
                .arg("--permission-mode")
                .arg(permission_mode)
                .arg(message);
        }
        ClaudeOutputMode::Text { max_turns } => {
            cmd.arg("--print");
            let fmt = output_format.map_or("text", |v| v.as_str());
            cmd.arg("--output-format")
                .arg(fmt)
                .arg("--permission-mode")
                .arg(permission_mode);
            // maxTurns from advanced config overrides output_mode's max_turns
            let effective_max_turns = adv.and_then(|a| a.max_turns).or(*max_turns);
            if let Some(turns) = effective_max_turns {
                cmd.arg("--max-turns").arg(turns.to_string());
            }
            cmd.arg(message);
        }
    }
}

fn apply_model_arg(cmd: &mut Command, config: &Config) {
    if let Some(ref model) = config.claude_code.model {
        if !model.is_empty() {
            cmd.arg("--model").arg(model);
        }
    }
}

fn apply_io_settings(cmd: &mut Command) {
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
}

fn apply_work_dir(cmd: &mut Command, config: &Config) {
    if let Some(ref work_dir) = config.work_dir {
        cmd.current_dir(work_dir);
    }
}

fn apply_git_bash_env(cmd: &mut Command, config: &Config) {
    if let Some(ref git_bash_path) = config.git_bin_path {
        cmd.env("CLAUDE_CODE_GIT_BASH_PATH", git_bash_path);
    }
}

fn apply_engine_env(cmd: &mut Command, config: &Config) {
    eprintln!("[apply_engine_env] claude_code config: api_key={:?}, base_url={:?}, model={:?}",
        config.resolve_claude_api_key().map(|k| if k.len() > 8 { &k[..8] } else { k }),
        config.resolve_claude_base_url(),
        config.claude_code.model,
    );

    // 当 UI 配置了值时，先移除系统环境变量再设置，确保 UI 值优先
    if let Some(api_key) = config.resolve_claude_api_key() {
        eprintln!("[apply_engine_env] 设置 ANTHROPIC_API_KEY");
        cmd.env_remove("ANTHROPIC_API_KEY");
        cmd.env("ANTHROPIC_API_KEY", api_key);
    }
    if let Some(base_url) = config.resolve_claude_base_url() {
        eprintln!("[apply_engine_env] 设置 ANTHROPIC_BASE_URL={}", base_url);
        cmd.env_remove("ANTHROPIC_BASE_URL");
        cmd.env("ANTHROPIC_BASE_URL", base_url);
    }
    if let Some(ref model) = config.claude_code.model {
        if !model.is_empty() {
            eprintln!("[apply_engine_env] 设置 ANTHROPIC_MODEL={}", model);
            cmd.env_remove("ANTHROPIC_MODEL");
            cmd.env("ANTHROPIC_MODEL", model);
        }
    }
}

fn apply_platform_flags(cmd: &mut Command) {
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}
