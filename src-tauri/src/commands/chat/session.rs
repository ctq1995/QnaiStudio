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
            callback(StreamEvent::SessionEnd);
        }
    }
}

pub struct ClaudeStartParams<'a> {
    pub config: &'a Config,
    pub message: &'a str,
    pub system_prompt: Option<&'a str>,
    pub session_id: Option<String>,
}

pub struct ClaudeCommandArgs<'a> {
    pub config: &'a Config,
    pub message: &'a str,
    pub system_prompt: Option<&'a str>,
    pub resume_session_id: Option<&'a str>,
}

pub fn build_claude_command(args: ClaudeCommandArgs<'_>) -> Result<Command> {
    let mut cmd = build_platform_command(&args)?;
    apply_io_settings(&mut cmd);
    apply_work_dir(&mut cmd, args.config);
    apply_git_bash_env(&mut cmd, args.config);
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
            if matches!(event, StreamEvent::SessionEnd) {
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
        let (node_exe, cli_js) = resolve_node_and_cli(&claude_cmd)?;
        Ok(build_node_command(&node_exe, &cli_js, args))
    }

    #[cfg(not(windows))]
    {
        Ok(build_direct_command(args))
    }
}

#[cfg(windows)]
fn resolve_node_and_cli(claude_cmd_path: &str) -> Result<(String, String)> {
    let cmd_path = Path::new(claude_cmd_path);
    let npm_dir = cmd_path.parent()
        .ok_or_else(|| AppError::ProcessError("无法获取 claude.cmd 的父目录".to_string()))?;
    let node_exe = find_node_exe(npm_dir)?;
    let cli_js = find_cli_js(npm_dir)?;
    Ok((node_exe, cli_js))
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
fn build_node_command(node_exe: &str, cli_js: &str, args: &ClaudeCommandArgs<'_>) -> Command {
    let mut cmd = Command::new(node_exe);
    cmd.arg(cli_js);
    apply_resume_arg(&mut cmd, args.resume_session_id);
    apply_system_prompt(&mut cmd, args.system_prompt);
    apply_stream_args(&mut cmd, args.message);
    cmd
}

#[cfg(not(windows))]
fn build_direct_command(args: &ClaudeCommandArgs<'_>) -> Command {
    let claude_cmd = args.config.get_claude_cmd();
    let mut cmd = Command::new(&claude_cmd);
    apply_resume_arg(&mut cmd, args.resume_session_id);
    apply_system_prompt(&mut cmd, args.system_prompt);
    apply_stream_args(&mut cmd, args.message);
    cmd
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

fn apply_stream_args(cmd: &mut Command, message: &str) {
    cmd.arg("--print")
        .arg("--verbose")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--permission-mode")
        .arg("bypassPermissions")
        .arg(message);
}

fn apply_io_settings(cmd: &mut Command) {
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
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

fn apply_platform_flags(cmd: &mut Command) {
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
}
