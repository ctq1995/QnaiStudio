use crate::error::{AppError, Result};
use crate::models::config::{Config, EngineId, HealthStatus};
use crate::utils::encoding::decode_cli_output;
use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

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
    pub fn new() -> Result<Self> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| AppError::ConfigError("无法获取配置目录".to_string()))?
            .join("claude-code-pro");
        std::fs::create_dir_all(&config_dir)?;

        let config_path = config_dir.join("config.json");
        let mut config = Self::load_from_file(&config_path)?;
        config.migrate();

        Self::hydrate_default_path(&mut config.claude_code.cli_path, "claude");
        Self::hydrate_default_path(&mut config.codex_cli.cli_path, "codex");
        Self::hydrate_default_path(&mut config.gemini.cli_path, "gemini");

        if !config_path.exists() {
            Self::save_config_to_path(&config, &config_path)?;
        }

        Ok(Self { config, config_path })
    }

    fn hydrate_default_path(path: &mut String, command_name: &str) {
        if path == command_name {
            if let Some(full_path) = Self::resolve_cli_path(command_name) {
                *path = full_path;
            }
        }
    }

    fn save_config_to_path(config: &Config, path: &Path) -> Result<()> {
        let content = serde_json::to_string_pretty(config)?;
        std::fs::write(path, content)?;
        Ok(())
    }

    fn load_from_file(path: &Path) -> Result<Config> {
        if !path.exists() {
            return Ok(Config::default());
        }

        let content = std::fs::read_to_string(path)?;
        if let Ok(mut config) = serde_json::from_str::<Config>(&content) {
            config.migrate();
            return Ok(config);
        }

        if let Ok(old_config) = serde_json::from_str::<OldConfig>(&content) {
            return Ok(old_config.migrate_to_new());
        }

        Ok(Config::default())
    }

    pub fn save(&self) -> Result<()> {
        Self::save_config_to_path(&self.config, &self.config_path)
    }

    pub fn get(&self) -> &Config {
        &self.config
    }

    pub fn update(&mut self, config: Config) -> Result<()> {
        self.config = config;
        self.save()
    }

    pub fn set_work_dir(&mut self, path: Option<PathBuf>) -> Result<()> {
        self.config.work_dir = path;
        self.save()
    }

    pub fn set_claude_cmd(&mut self, cmd: String) -> Result<()> {
        self.config.claude_code.cli_path = cmd;
        self.save()
    }

    pub fn set_codex_cmd(&mut self, cmd: String) -> Result<()> {
        self.config.codex_cli.cli_path = cmd;
        self.save()
    }

    pub fn set_gemini_cmd(&mut self, cmd: String) -> Result<()> {
        self.config.gemini.cli_path = cmd;
        self.save()
    }

    pub fn set_iflow_cmd(&mut self, cmd: String) -> Result<()> {
        self.config.iflow.cli_path = Some(cmd);
        self.save()
    }

    pub fn set_engine(&mut self, engine_id: EngineId) -> Result<()> {
        self.config.set_engine_id(engine_id);
        self.save()
    }

    pub fn session_dir(&self) -> Result<PathBuf> {
        if let Some(ref dir) = self.config.session_dir {
            return Ok(dir.clone());
        }

        let data_dir = dirs::data_local_dir()
            .ok_or_else(|| AppError::ConfigError("无法获取数据目录".to_string()))?
            .join("claude-code-pro")
            .join("sessions");
        std::fs::create_dir_all(&data_dir)?;
        Ok(data_dir)
    }

    pub fn set_session_dir(&mut self, path: PathBuf) -> Result<()> {
        std::fs::create_dir_all(&path)?;
        self.config.session_dir = Some(path);
        self.save()
    }

    pub fn current_work_dir(&self) -> PathBuf {
        self.config
            .work_dir
            .clone()
            .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    }

    pub fn detect_claude(&self) -> Option<String> {
        Self::detect_version(&self.config.get_claude_cmd())
    }

    pub fn detect_codex(&self) -> Option<String> {
        Self::detect_version(&self.config.get_codex_cmd())
    }

    pub fn detect_gemini(&self) -> Option<String> {
        Self::detect_version(&self.config.get_gemini_cmd())
    }

    pub fn detect_iflow(&self) -> Option<String> {
        let cli_path = self
            .config
            .iflow
            .cli_path
            .clone()
            .or_else(Self::find_iflow_path)?;
        Self::detect_version(&cli_path)
    }

    fn detect_version(command_path: &str) -> Option<String> {
        let output = Command::new(command_path)
            .arg("--version")
            .no_window()
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        decode_cli_output(&output.stdout)
            .lines()
            .next()
            .map(|line| line.trim().to_string())
    }

    pub fn health_status(&self) -> HealthStatus {
        let claude_version = self.detect_claude();
        let iflow_version = self.detect_iflow();
        let codex_version = self.detect_codex();
        let gemini_version = self.detect_gemini();

        HealthStatus {
            claude_available: claude_version.is_some(),
            claude_version,
            iflow_available: iflow_version.is_some(),
            iflow_version,
            codex_available: codex_version.is_some(),
            codex_version,
            gemini_available: gemini_version.is_some(),
            gemini_version,
            work_dir: self
                .config
                .work_dir
                .as_ref()
                .and_then(|path| path.to_str().map(|value| value.to_string())),
            config_valid: true,
        }
    }

    pub fn find_claude_paths() -> Vec<String> {
        Self::find_cli_paths("claude")
    }

    pub fn find_codex_paths() -> Vec<String> {
        Self::find_cli_paths("codex")
    }

    pub fn find_gemini_paths() -> Vec<String> {
        Self::find_cli_paths("gemini")
    }

    pub fn find_iflow_paths() -> Vec<String> {
        Self::find_cli_paths("iflow")
    }

    pub fn find_iflow_path() -> Option<String> {
        Self::resolve_cli_path("iflow")
    }

    pub fn validate_claude_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_cli_path(path)
    }

    pub fn validate_codex_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_cli_path(path)
    }

    pub fn validate_gemini_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_cli_path(path)
    }

    pub fn validate_iflow_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        Self::validate_cli_path(path)
    }

    fn validate_cli_path(path: String) -> Result<(bool, Option<String>, Option<String>)> {
        if !Path::new(&path).exists() {
            return Ok((false, Some("文件不存在".to_string()), None));
        }

        match Command::new(&path).arg("--version").no_window().output() {
            Ok(output) if output.status.success() => {
                let version = decode_cli_output(&output.stdout)
                    .lines()
                    .next()
                    .map(|line| line.trim().to_string());
                Ok((true, None, version))
            }
            Ok(output) => {
                let stderr = decode_cli_output(&output.stderr).trim().to_string();
                Ok((false, Some(format!("执行失败: {}", stderr)), None))
            }
            Err(error) => Ok((false, Some(format!("无法执行: {}", error)), None)),
        }
    }

    fn find_cli_paths(command_name: &str) -> Vec<String> {
        let mut paths = Vec::new();

        if let Some(path) = Self::resolve_cli_path(command_name) {
            paths.push(path);
        }

        for path in Self::common_cli_candidates(command_name) {
            if !paths.contains(&path) && Path::new(&path).exists() && Self::is_valid_cli(&path) {
                paths.push(path);
            }
        }

        paths
    }

    fn is_valid_cli(path: &str) -> bool {
        Command::new(path)
            .arg("--version")
            .no_window()
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }

    fn common_cli_candidates(command_name: &str) -> Vec<String> {
        #[cfg(windows)]
        {
            let user_profile = env::var("USERPROFILE").unwrap_or_default();
            return vec![
                format!(r"{}\AppData\Roaming\npm\{}.cmd", user_profile, command_name),
                format!(r"{}\AppData\Roaming\npm\{}.exe", user_profile, command_name),
                format!(r"{}\scoop\shims\{}.cmd", user_profile, command_name),
            ];
        }

        #[cfg(not(windows))]
        {
            let home = env::var("HOME").unwrap_or_default();
            return vec![
                format!("/opt/homebrew/bin/{}", command_name),
                format!("/usr/local/bin/{}", command_name),
                format!("/usr/bin/{}", command_name),
                format!("{}/.npm-global/bin/{}", home, command_name),
                format!("{}/.local/bin/{}", home, command_name),
            ];
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
            },
            codex_cli: Default::default(),
            iflow: Default::default(),
            gemini: Default::default(),
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
