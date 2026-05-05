use crate::error::{AppError, Result};
use crate::models::config::{Config, HealthStatus};
use crate::utils::encoding::decode_cli_output;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

trait CommandExt {
    fn no_window(&mut self) -> &mut Self;
}

impl CommandExt for Command {
    fn no_window(&mut self) -> &mut Self {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            self.creation_flags(CREATE_NO_WINDOW);
        }
        self
    }
}

pub struct ConfigStore {
    config: Config,
    config_path: PathBuf,
}

impl ConfigStore {
    fn sanitize_work_dir(work_dir: &mut Option<PathBuf>) {
        let Some(dir) = work_dir.as_ref() else {
            return;
        };

        if dir.is_dir() {
            return;
        }

        eprintln!(
            "[ConfigStore] 清理无效 workDir: {}",
            dir.to_string_lossy()
        );
        *work_dir = None;
    }

    pub fn new() -> Result<Self> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| AppError::ConfigError("无法获取配置目录".to_string()))?
            .join("claude-code-pro");
        fs::create_dir_all(&config_dir)?;

        let config_path = config_dir.join("config.json");
        let mut config = Self::load_from_file(&config_path)?;
        config.migrate();
        Self::sanitize_work_dir(&mut config.work_dir);

        Self::hydrate_path_fast(&mut config.claude_code.cli_path, "claude");
        Self::hydrate_path_fast(&mut config.codex_cli.cli_path, "codex");
        if let Some(ref mut iflow_path) = config.iflow.cli_path {
            Self::hydrate_path_fast(iflow_path, "iflow");
        }
        Self::hydrate_path_fast(&mut config.gemini.cli_path, "gemini");

        if !config_path.exists() {
            Self::save_config_to_path(&config, &config_path)?;
        }

        Ok(Self { config, config_path })
    }

    pub fn get(&self) -> &Config {
        &self.config
    }

    pub fn update(&mut self, mut config: Config) -> Result<()> {
        config.migrate();
        Self::sanitize_work_dir(&mut config.work_dir);
        Self::save_config_to_path(&config, &self.config_path)?;
        self.config = config;
        Ok(())
    }

    fn load_from_file(config_path: &Path) -> Result<Config> {
        if !config_path.exists() {
            return Ok(Config::default());
        }

        let content = fs::read_to_string(config_path)?;
        match serde_json::from_str::<Config>(&content) {
            Ok(config) => Ok(config),
            Err(_) => {
                let old = serde_json::from_str::<OldConfig>(&content)?;
                Ok(old.migrate_to_new())
            }
        }
    }

    fn save_config_to_path(config: &Config, config_path: &Path) -> Result<()> {
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(config)?;
        let temp_path = config_path.with_extension("json.tmp");
        fs::write(&temp_path, content)?;
        fs::rename(&temp_path, config_path)?;
        Ok(())
    }

    fn common_cli_candidates(command_name: &str) -> Vec<String> {
        let mut candidates = Vec::new();

        #[cfg(windows)]
        {
            if let Ok(appdata) = env::var("APPDATA") {
                candidates.push(format!(r"{}\npm\{}.cmd", appdata, command_name));
                candidates.push(format!(r"{}\npm\{}.ps1", appdata, command_name));
            }
            if let Ok(local) = env::var("LOCALAPPDATA") {
                candidates.push(format!(r"{}\Programs\{}\{}.cmd", local, command_name, command_name));
            }
        }

        #[cfg(not(windows))]
        {
            candidates.push(format!("/usr/local/bin/{}", command_name));
            candidates.push(format!("/opt/homebrew/bin/{}", command_name));
            candidates.push(format!("/usr/bin/{}", command_name));
            if let Ok(home) = env::var("HOME") {
                candidates.push(format!("{}/.npm-global/bin/{}", home, command_name));
                candidates.push(format!("{}/bin/{}", home, command_name));
            }
        }

        candidates
    }

    fn hydrate_path_fast(path: &mut String, command_name: &str) {
        if path != command_name && Path::new(path).exists() {
            return;
        }
        for candidate in Self::common_cli_candidates(command_name) {
            if Path::new(&candidate).exists() {
                *path = candidate;
                return;
            }
        }
    }

    fn resolve_cli_path(command_name: &str) -> Option<String> {
        #[cfg(windows)]
        {
            let ps_command = format!(
                "Get-Command {} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source",
                command_name
            );
            let ps_output = Command::new("powershell")
                .args(["-Command", &ps_command])
                .no_window()
                .output()
                .ok();

            if let Some(output) = ps_output {
                if output.status.success() {
                    let path = decode_cli_output(&output.stdout).trim().to_string();
                    if let Some(path) = Self::normalize_windows_command_path(path) {
                        return Some(path);
                    }
                }
            }

            let output = Command::new("where")
                .arg(command_name)
                .no_window()
                .output()
                .ok()?;

            if output.status.success() {
                let path = decode_cli_output(&output.stdout).lines().next()?.trim().to_string();
                return Self::normalize_windows_command_path(path);
            }

            None
        }

        #[cfg(not(windows))]
        {
            let output = Command::new("which")
                .arg(command_name)
                .no_window()
                .output()
                .ok()?;
            if output.status.success() {
                return decode_cli_output(&output.stdout)
                    .lines()
                    .next()
                    .map(|line| line.trim().to_string());
            }
            None
        }
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

    fn find_paths_for(command_name: &str) -> Vec<String> {
        let mut paths = Self::common_cli_candidates(command_name);
        if let Some(path) = Self::resolve_cli_path(command_name) {
            paths.push(path);
        }
        paths.sort();
        paths.dedup();
        paths.into_iter().filter(|path| Path::new(path).exists()).collect()
    }

    fn validate_command_path(path: String, version_arg: &str) -> Result<(bool, Option<String>, Option<String>)> {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Ok((false, Some("路径不能为空".to_string()), None));
        }

        if !Path::new(trimmed).exists() {
            return Ok((false, Some("文件不存在".to_string()), None));
        }

        let mut command = Command::new(trimmed);
        command
            .arg(version_arg)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .no_window();

        let mut child = command.spawn()?;
        let start = Instant::now();
        let timeout = Duration::from_secs(5);

        loop {
            if let Some(status) = child.try_wait()? {
                let mut output = Vec::new();
                if let Some(mut stdout) = child.stdout.take() {
                    let _ = stdout.read_to_end(&mut output);
                }
                if output.is_empty() {
                    if let Some(mut stderr) = child.stderr.take() {
                        let _ = stderr.read_to_end(&mut output);
                    }
                }
                let version_text = String::from_utf8_lossy(&output).trim().to_string();
                return Ok((
                    status.success(),
                    if status.success() { None } else { Some("命令执行失败".to_string()) },
                    if version_text.is_empty() { None } else { Some(version_text) },
                ));
            }

            if start.elapsed() >= timeout {
                let _ = child.kill();
                return Ok((false, Some("命令执行超时".to_string()), None));
            }

            std::thread::sleep(Duration::from_millis(50));
        }
    }

    pub fn find_claude_paths() -> Vec<String> {
        Self::find_paths_for("claude")
    }

    pub fn find_codex_paths() -> Vec<String> {
        Self::find_paths_for("codex")
    }

    pub fn find_iflow_paths() -> Vec<String> {
        Self::find_paths_for("iflow")
    }

    pub fn find_iflow_path() -> Option<String> {
        Self::find_iflow_paths().into_iter().next()
    }

    pub fn find_gemini_paths() -> Vec<String> {
        Self::find_paths_for("gemini")
    }

    pub fn validate_claude_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_command_path(path, "--version")
    }

    pub fn validate_codex_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_command_path(path, "--version")
    }

    pub fn validate_iflow_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_command_path(path, "--version")
    }

    pub fn validate_gemini_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_command_path(path, "--version")
    }

    pub fn detect_claude(&self) -> Option<String> {
        if self.config.get_claude_cmd() != "claude" && Path::new(&self.config.get_claude_cmd()).exists() {
            return Some(self.config.get_claude_cmd());
        }
        Self::find_claude_paths().into_iter().next()
    }

    pub fn health_status_for_config(config: &Config) -> Result<HealthStatus> {
        let claude_path = config.get_claude_cmd();
        let codex_path = config.get_codex_cmd();
        let gemini_path = config.get_gemini_cmd();
        let iflow_path = config.iflow.cli_path.clone().or_else(Self::find_iflow_path);

        let (claude_available, claude_version) = Self::probe_engine_health(&claude_path, "--version")?;
        let (codex_available, codex_version) = Self::probe_engine_health(&codex_path, "--version")?;
        let (gemini_available, gemini_version) = Self::probe_engine_health(&gemini_path, "--version")?;
        let (iflow_available, iflow_version) = match iflow_path {
            Some(path) => Self::probe_engine_health(&path, "--version")?,
            None => (false, None),
        };

        Ok(HealthStatus {
            claude_available,
            claude_version,
            iflow_available,
            iflow_version,
            codex_available,
            codex_version,
            gemini_available,
            gemini_version,
            work_dir: config.work_dir.as_ref().map(|p| p.to_string_lossy().to_string()),
            config_valid: claude_available || codex_available || iflow_available || gemini_available,
        })
    }

    fn probe_engine_health(path: &str, version_arg: &str) -> Result<(bool, Option<String>)> {
        let trimmed = path.trim();
        if trimmed.is_empty() {
            return Ok((false, None));
        }

        let (valid, _, version) = Self::validate_command_path(trimmed.to_string(), version_arg)?;
        Ok((valid, version))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OldConfig {
    claude_cmd: String,
    work_dir: Option<PathBuf>,
    session_dir: Option<PathBuf>,
    git_bin_path: Option<String>,
}

impl OldConfig {
    fn migrate_to_new(self) -> Config {
        let claude_cmd_clone = self.claude_cmd.clone();
        Config {
            default_engine: "claude-code".to_string(),
            claude_code: crate::models::config::ClaudeCodeConfig {
                cli_path: self.claude_cmd,
                provider_id: None,
                api_key: None,
                base_url: None,
                model: None,
                advanced: None,
            },
            codex_cli: Default::default(),
            iflow: Default::default(),
            gemini: Default::default(),
            providers: Vec::new(),
            work_dir: self.work_dir,
            session_dir: self.session_dir,
            git_bin_path: self.git_bin_path,
            floating_window: Default::default(),
            claude_cmd: Some(claude_cmd_clone),
        }
    }
}

impl Default for ConfigStore {
    fn default() -> Self {
        Self::new().expect("无法创建配置存储")
    }
}
