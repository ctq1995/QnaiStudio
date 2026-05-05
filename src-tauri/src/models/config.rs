use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ── Advanced parameter structs ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ClaudePermissionMode {
    BypassPermissions,
    Default,
    Plan,
}

impl Default for ClaudePermissionMode {
    fn default() -> Self {
        Self::BypassPermissions
    }
}

impl ClaudePermissionMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::BypassPermissions => "bypassPermissions",
            Self::Default => "default",
            Self::Plan => "plan",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeAdvancedParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub append_system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub permission_mode: Option<ClaudePermissionMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_turns: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verbose: Option<bool>,
}

impl Default for ClaudeAdvancedParams {
    fn default() -> Self {
        Self {
            system_prompt: None,
            append_system_prompt: None,
            permission_mode: Some(ClaudePermissionMode::BypassPermissions),
            max_turns: None,
            output_format: None,
            verbose: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CodexApprovalMode {
    Suggest,
    #[serde(rename = "auto-edit")]
    AutoEdit,
    #[serde(rename = "full-auto")]
    FullAuto,
}

impl CodexApprovalMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Suggest => "suggest",
            Self::AutoEdit => "auto-edit",
            Self::FullAuto => "full-auto",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexAdvancedParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_git_repo_check: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bypass_approvals_and_sandbox: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_mode: Option<CodexApprovalMode>,
}

impl Default for CodexAdvancedParams {
    fn default() -> Self {
        Self {
            skip_git_repo_check: Some(true),
            bypass_approvals_and_sandbox: Some(true),
            approval_mode: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum GeminiApprovalMode {
    #[serde(rename = "default")]
    DefaultMode,
    #[serde(rename = "auto-edit")]
    AutoEdit,
    Yolo,
    Plan,
}

impl GeminiApprovalMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::DefaultMode => "default",
            Self::AutoEdit => "auto-edit",
            Self::Yolo => "yolo",
            Self::Plan => "plan",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiAdvancedParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yolo: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_mode: Option<GeminiApprovalMode>,
}

impl Default for GeminiAdvancedParams {
    fn default() -> Self {
        Self {
            yolo: Some(true),
            sandbox: None,
            approval_mode: None,
        }
    }
}

// ── Provider & engine config structs ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProviderConfig {
    pub id: String,
    pub name: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCodeConfig {
    pub cli_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advanced: Option<ClaudeAdvancedParams>,
}

impl Default for ClaudeCodeConfig {
    fn default() -> Self {
        Self {
            cli_path: "claude".to_string(),
            provider_id: None,
            api_key: None,
            base_url: None,
            model: None,
            advanced: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexCliConfig {
    pub cli_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advanced: Option<CodexAdvancedParams>,
}

impl Default for CodexCliConfig {
    fn default() -> Self {
        Self {
            cli_path: "codex".to_string(),
            provider_id: None,
            api_key: None,
            base_url: None,
            model: None,
            advanced: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IFlowConfig {
    pub cli_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for IFlowConfig {
    fn default() -> Self {
        Self { cli_path: None, provider_id: None, api_key: None, base_url: None, model: None }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiConfig {
    pub cli_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advanced: Option<GeminiAdvancedParams>,
}

impl Default for GeminiConfig {
    fn default() -> Self {
        Self {
            cli_path: "gemini".to_string(),
            provider_id: None,
            api_key: None,
            base_url: None,
            model: None,
            advanced: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomCliConfig {
    pub cli_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

impl Default for CustomCliConfig {
    fn default() -> Self {
        Self {
            cli_path: "custom-cli".to_string(),
            provider_id: None,
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
    CustomCli,
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
            Self::CustomCli => "custom-cli",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "claude-code" => Some(Self::ClaudeCode),
            "codex-cli" => Some(Self::CodexCli),
            "iflow" => Some(Self::IFlow),
            "gemini" => Some(Self::Gemini),
            "custom-cli" => Some(Self::CustomCli),
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
    #[serde(default)]
    pub custom_cli: CustomCliConfig,
    #[serde(default)]
    pub providers: Vec<ModelProviderConfig>,
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
            custom_cli: CustomCliConfig::default(),
            providers: Vec::new(),
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

    pub fn get_custom_cli_cmd(&self) -> String {
        self.custom_cli.cli_path.clone()
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

        if self.custom_cli.cli_path.is_empty() {
            self.custom_cli.cli_path = "custom-cli".to_string();
        }

        if self.providers.is_empty() {
            self.try_migrate_legacy_provider();
        }
    }

    pub fn get_provider(&self, provider_id: Option<&str>) -> Option<&ModelProviderConfig> {
        let provider_id = provider_id?.trim();
        if provider_id.is_empty() {
            return None;
        }
        self.providers.iter().find(|provider| provider.id == provider_id)
    }

    fn try_migrate_legacy_provider(&mut self) {
        let mut migrated = Vec::new();

        if self.claude_code.base_url.as_ref().is_some() || self.claude_code.api_key.as_ref().is_some() {
            let provider_id = "provider-claude-code-legacy".to_string();
            self.claude_code.provider_id = Some(provider_id.clone());
            migrated.push(ModelProviderConfig {
                id: provider_id,
                name: "Claude 旧配置迁移".to_string(),
                kind: "anthropic-compatible".to_string(),
                api_key: self.claude_code.api_key.clone(),
                base_url: self.claude_code.base_url.clone(),
            });
        }

        if self.codex_cli.base_url.as_ref().is_some() || self.codex_cli.api_key.as_ref().is_some() {
            let provider_id = "provider-codex-cli-legacy".to_string();
            self.codex_cli.provider_id = Some(provider_id.clone());
            migrated.push(ModelProviderConfig {
                id: provider_id,
                name: "Codex 旧配置迁移".to_string(),
                kind: "openai-compatible".to_string(),
                api_key: self.codex_cli.api_key.clone(),
                base_url: self.codex_cli.base_url.clone(),
            });
        }

        if self.gemini.base_url.as_ref().is_some() || self.gemini.api_key.as_ref().is_some() {
            let provider_id = "provider-gemini-legacy".to_string();
            self.gemini.provider_id = Some(provider_id.clone());
            migrated.push(ModelProviderConfig {
                id: provider_id,
                name: "Gemini 旧配置迁移".to_string(),
                kind: "gemini-compatible".to_string(),
                api_key: self.gemini.api_key.clone(),
                base_url: self.gemini.base_url.clone(),
            });
        }

        if self.iflow.base_url.as_ref().is_some() || self.iflow.api_key.as_ref().is_some() {
            let provider_id = "provider-iflow-legacy".to_string();
            self.iflow.provider_id = Some(provider_id.clone());
            migrated.push(ModelProviderConfig {
                id: provider_id,
                name: "IFlow 旧配置迁移".to_string(),
                kind: "custom".to_string(),
                api_key: self.iflow.api_key.clone(),
                base_url: self.iflow.base_url.clone(),
            });
        }

        if self.custom_cli.base_url.as_ref().is_some() || self.custom_cli.api_key.as_ref().is_some() {
            let provider_id = "provider-custom-cli-legacy".to_string();
            self.custom_cli.provider_id = Some(provider_id.clone());
            migrated.push(ModelProviderConfig {
                id: provider_id,
                name: "Custom CLI 旧配置迁移".to_string(),
                kind: "custom".to_string(),
                api_key: self.custom_cli.api_key.clone(),
                base_url: self.custom_cli.base_url.clone(),
            });
        }

        if !migrated.is_empty() {
            self.providers = migrated;
        }
    }

    pub fn resolve_claude_api_key(&self) -> Option<&str> {
        self.get_provider(self.claude_code.provider_id.as_deref())
            .and_then(|provider| provider.api_key.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.claude_code.api_key.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_claude_base_url(&self) -> Option<&str> {
        self.get_provider(self.claude_code.provider_id.as_deref())
            .and_then(|provider| provider.base_url.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.claude_code.base_url.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_codex_api_key(&self) -> Option<&str> {
        self.get_provider(self.codex_cli.provider_id.as_deref())
            .and_then(|provider| provider.api_key.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.codex_cli.api_key.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_codex_base_url(&self) -> Option<&str> {
        self.get_provider(self.codex_cli.provider_id.as_deref())
            .and_then(|provider| provider.base_url.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.codex_cli.base_url.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_gemini_api_key(&self) -> Option<&str> {
        self.get_provider(self.gemini.provider_id.as_deref())
            .and_then(|provider| provider.api_key.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.gemini.api_key.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_gemini_base_url(&self) -> Option<&str> {
        self.get_provider(self.gemini.provider_id.as_deref())
            .and_then(|provider| provider.base_url.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.gemini.base_url.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_iflow_api_key(&self) -> Option<&str> {
        self.get_provider(self.iflow.provider_id.as_deref())
            .and_then(|provider| provider.api_key.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.iflow.api_key.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_iflow_base_url(&self) -> Option<&str> {
        self.get_provider(self.iflow.provider_id.as_deref())
            .and_then(|provider| provider.base_url.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.iflow.base_url.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_custom_cli_api_key(&self) -> Option<&str> {
        self.get_provider(self.custom_cli.provider_id.as_deref())
            .and_then(|provider| provider.api_key.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.custom_cli.api_key.as_deref().filter(|v| !v.is_empty()))
    }

    pub fn resolve_custom_cli_base_url(&self) -> Option<&str> {
        self.get_provider(self.custom_cli.provider_id.as_deref())
            .and_then(|provider| provider.base_url.as_deref().filter(|v| !v.is_empty()))
            .or_else(|| self.custom_cli.base_url.as_deref().filter(|v| !v.is_empty()))
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
    pub custom_cli_available: bool,
    pub custom_cli_version: Option<String>,
    pub work_dir: Option<String>,
    pub config_valid: bool,
}
