use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCodeConfig {
    pub cli_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for ClaudeCodeConfig {
    fn default() -> Self {
        Self {
            cli_path: "claude".to_string(),
            api_key: None,
            base_url: None,
            model: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCliConfig {
    pub cli_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for CodexCliConfig {
    fn default() -> Self {
        Self {
            cli_path: "codex".to_string(),
            api_key: None,
            base_url: None,
            model: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IFlowConfig {
    pub cli_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for IFlowConfig {
    fn default() -> Self {
        Self { cli_path: None, api_key: None, base_url: None, model: None }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiConfig {
    pub cli_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for GeminiConfig {
    fn default() -> Self {
        Self {
            cli_path: "gemini".to_string(),
            api_key: None,
            base_url: None,
            model: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum EngineId {
    ClaudeCode,
    CodexCli,
    IFlow,
    Gemini,
}

impl Default for EngineId {
    fn default() -> Self {
        Self::ClaudeCode
    }
}

impl EngineId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude-code",
            Self::CodexCli => "codex-cli",
            Self::IFlow => "iflow",
            Self::Gemini => "gemini",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "claude-code" => Some(Self::ClaudeCode),
            "codex-cli" => Some(Self::CodexCli),
            "iflow" => Some(Self::IFlow),
            "gemini" => Some(Self::Gemini),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum FloatingWindowMode {
    Auto,
    Manual,
}

impl Default for FloatingWindowMode {
    fn default() -> Self {
        Self::Auto
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FloatingWindowConfig {
    #[serde(default = "default_floating_window_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub mode: FloatingWindowMode,
    #[serde(default = "default_floating_window_expand_on_hover")]
    pub expand_on_hover: bool,
    #[serde(default = "default_floating_window_collapse_delay")]
    pub collapse_delay: u64,
}

fn default_floating_window_enabled() -> bool {
    true
}

fn default_floating_window_expand_on_hover() -> bool {
    true
}

fn default_floating_window_collapse_delay() -> u64 {
    500
}

impl Default for FloatingWindowConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            mode: FloatingWindowMode::Auto,
            expand_on_hover: true,
            collapse_delay: 500,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(default = "default_default_engine")]
    pub default_engine: String,
    #[serde(default)]
    pub claude_code: ClaudeCodeConfig,
    #[serde(default)]
    pub codex_cli: CodexCliConfig,
    #[serde(default)]
    pub iflow: IFlowConfig,
    #[serde(default)]
    pub gemini: GeminiConfig,
    pub work_dir: Option<PathBuf>,
    pub session_dir: Option<PathBuf>,
    pub git_bin_path: Option<String>,
    #[serde(default)]
    pub floating_window: FloatingWindowConfig,
    #[serde(default)]
    pub claude_cmd: Option<String>,
}

fn default_default_engine() -> String {
    "claude-code".to_string()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            default_engine: default_default_engine(),
            claude_code: ClaudeCodeConfig::default(),
            codex_cli: CodexCliConfig::default(),
            iflow: IFlowConfig::default(),
            gemini: GeminiConfig::default(),
            work_dir: None,
            session_dir: None,
            git_bin_path: None,
            floating_window: FloatingWindowConfig::default(),
            claude_cmd: None,
        }
    }
}

impl Config {
    pub fn get_claude_cmd(&self) -> String {
        if let Some(ref cmd) = self.claude_cmd {
            if !cmd.is_empty() {
                return cmd.clone();
            }
        }
        self.claude_code.cli_path.clone()
    }

    pub fn get_codex_cmd(&self) -> String {
        self.codex_cli.cli_path.clone()
    }

    pub fn get_gemini_cmd(&self) -> String {
        self.gemini.cli_path.clone()
    }

    pub fn migrate(&mut self) {
        if let Some(ref cmd) = self.claude_cmd {
            if self.claude_code.cli_path == "claude" && !cmd.is_empty() {
                self.claude_code.cli_path = cmd.clone();
            }
        }

        if EngineId::from_str(&self.default_engine).is_none() {
            self.default_engine = default_default_engine();
        }

        if self.gemini.cli_path.is_empty() {
            self.gemini.cli_path = "gemini".to_string();
        }
    }

    pub fn get_engine_id(&self) -> EngineId {
        EngineId::from_str(&self.default_engine).unwrap_or(EngineId::ClaudeCode)
    }

    pub fn set_engine_id(&mut self, engine_id: EngineId) {
        self.default_engine = engine_id.as_str().to_string();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub claude_available: bool,
    pub claude_version: Option<String>,
    pub iflow_available: bool,
    pub iflow_version: Option<String>,
    pub codex_available: bool,
    pub codex_version: Option<String>,
    pub gemini_available: bool,
    pub gemini_version: Option<String>,
    pub work_dir: Option<String>,
    pub config_valid: bool,
}
