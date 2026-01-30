//! Main settings/configuration for C-napse

use crate::config::Paths;
use crate::error::{CnapseError, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Main settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub general: GeneralConfig,

    #[serde(default)]
    pub local: LocalConfig,

    #[serde(default)]
    pub ollama: OllamaConfig,

    #[serde(default)]
    pub anthropic: AnthropicConfig,

    #[serde(default)]
    pub openai: OpenAIConfig,

    #[serde(default)]
    pub openrouter: OpenRouterConfig,

    #[serde(default)]
    pub memory: MemoryConfig,

    #[serde(default)]
    pub server: ServerConfig,

    #[serde(default)]
    pub telegram: TelegramConfig,

    #[serde(default)]
    pub sync: SyncConfig,

    #[serde(default)]
    pub apps: AppsConfig,
}

/// General application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfig {
    /// Default inference provider
    #[serde(default = "default_provider")]
    pub default_provider: String,

    /// Logging level
    #[serde(default = "default_log_level")]
    pub log_level: String,

    /// Enable telemetry
    #[serde(default)]
    pub telemetry: bool,
}

/// Local inference settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalConfig {
    /// Directory containing model files
    #[serde(default = "default_models_dir")]
    pub models_dir: String,

    /// Number of threads for inference
    #[serde(default = "default_threads")]
    pub threads: usize,

    /// Number of GPU layers (0 = CPU only)
    #[serde(default)]
    pub gpu_layers: usize,

    /// Batch size for inference
    #[serde(default = "default_batch_size")]
    pub batch_size: usize,

    /// Context size
    #[serde(default = "default_context_size")]
    pub context_size: usize,

    /// Agent-specific model assignments
    #[serde(default)]
    pub agents: LocalAgentsConfig,
}

/// Model assignments for each agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalAgentsConfig {
    #[serde(default = "default_router_model")]
    pub router: String,

    #[serde(default = "default_coder_model")]
    pub coder: String,

    #[serde(default = "default_shell_model")]
    pub shell: String,

    #[serde(default = "default_filer_model")]
    pub filer: String,

    #[serde(default = "default_memory_model")]
    pub memory: String,

    #[serde(default = "default_app_model")]
    pub app: String,
}

/// Ollama settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaConfig {
    /// Ollama server URL
    #[serde(default = "default_ollama_url")]
    pub url: String,

    /// Keep models loaded in memory
    #[serde(default = "default_keep_alive")]
    pub keep_alive: String,

    /// Agent-specific Ollama model assignments
    #[serde(default)]
    pub agents: OllamaAgentsConfig,
}

/// Ollama model assignments for each agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaAgentsConfig {
    #[serde(default = "default_ollama_router")]
    pub router: String,

    #[serde(default = "default_ollama_coder")]
    pub coder: String,

    #[serde(default = "default_ollama_shell")]
    pub shell: String,

    #[serde(default = "default_ollama_filer")]
    pub filer: String,

    #[serde(default = "default_ollama_memory")]
    pub memory: String,

    #[serde(default = "default_ollama_app")]
    pub app: String,
}

/// Anthropic API settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicConfig {
    #[serde(default = "default_anthropic_model")]
    pub model: String,

    #[serde(default = "default_max_tokens")]
    pub max_tokens: usize,

    #[serde(default = "default_temperature")]
    pub temperature: f32,
}

/// OpenAI API settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIConfig {
    #[serde(default = "default_openai_model")]
    pub model: String,

    #[serde(default = "default_max_tokens")]
    pub max_tokens: usize,

    #[serde(default = "default_temperature")]
    pub temperature: f32,
}

/// OpenRouter API settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenRouterConfig {
    #[serde(default = "default_openrouter_model")]
    pub model: String,

    #[serde(default = "default_max_tokens")]
    pub max_tokens: usize,

    #[serde(default = "default_temperature")]
    pub temperature: f32,

    #[serde(default)]
    pub site_url: String,

    #[serde(default = "default_app_name")]
    pub app_name: String,
}

/// Memory/context settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    /// Number of recent turns kept verbatim
    #[serde(default = "default_hot_turns")]
    pub hot_turns: usize,

    /// Number of summarized chunks in context
    #[serde(default = "default_warm_chunks")]
    pub warm_chunks: usize,

    /// Enable cold storage to disk
    #[serde(default = "default_true")]
    pub cold_storage: bool,

    /// Embedding model source
    #[serde(default = "default_embedding_model")]
    pub embedding_model: String,

    /// Similarity threshold for retrieval
    #[serde(default = "default_similarity_threshold")]
    pub similarity_threshold: f32,
}

/// Server settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,

    #[serde(default = "default_port")]
    pub port: u16,

    #[serde(default = "default_true")]
    pub enable_auth: bool,

    #[serde(default = "default_cors_origins")]
    pub cors_origins: Vec<String>,

    #[serde(default)]
    pub ssl_cert: String,

    #[serde(default)]
    pub ssl_key: String,
}

/// Telegram bot settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    #[serde(default)]
    pub enabled: bool,

    #[serde(default)]
    pub allowed_users: Vec<i64>,

    #[serde(default)]
    pub webhook_url: String,
}

/// Sync settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    #[serde(default)]
    pub enabled: bool,

    #[serde(default)]
    pub phone_ip: String,

    #[serde(default = "default_true")]
    pub vscode_integration: bool,
}

/// Apps settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppsConfig {
    #[serde(default = "default_apps_dir")]
    pub storage_dir: String,

    #[serde(default = "default_max_apps")]
    pub max_apps: usize,

    #[serde(default = "default_framework")]
    pub default_framework: String,
}

// Default value functions
fn default_provider() -> String {
    "local".to_string()
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_models_dir() -> String {
    "~/.cnapse/models".to_string()
}

fn default_threads() -> usize {
    8
}

fn default_batch_size() -> usize {
    512
}

fn default_context_size() -> usize {
    4096
}

fn default_router_model() -> String {
    "qwen2.5-0.5b-instruct.Q4_K_M.gguf".to_string()
}

fn default_coder_model() -> String {
    "qwen2.5-coder-1.5b-instruct.Q4_K_M.gguf".to_string()
}

fn default_shell_model() -> String {
    "qwen2.5-0.5b-instruct.Q4_K_M.gguf".to_string()
}

fn default_filer_model() -> String {
    "qwen2.5-0.5b-instruct.Q4_K_M.gguf".to_string()
}

fn default_memory_model() -> String {
    "qwen2.5-0.5b-instruct.Q4_K_M.gguf".to_string()
}

fn default_app_model() -> String {
    "qwen2.5-coder-1.5b-instruct.Q4_K_M.gguf".to_string()
}

// Ollama defaults
fn default_ollama_url() -> String {
    "http://127.0.0.1:11434".to_string()
}

fn default_keep_alive() -> String {
    "5m".to_string()
}

fn default_ollama_router() -> String {
    "qwen2.5:0.5b".to_string()
}

fn default_ollama_coder() -> String {
    "qwen2.5-coder:1.5b".to_string()
}

fn default_ollama_shell() -> String {
    "qwen2.5:0.5b".to_string()
}

fn default_ollama_filer() -> String {
    "qwen2.5:0.5b".to_string()
}

fn default_ollama_memory() -> String {
    "qwen2.5:0.5b".to_string()
}

fn default_ollama_app() -> String {
    "qwen2.5-coder:1.5b".to_string()
}

fn default_anthropic_model() -> String {
    "claude-sonnet-4-20250514".to_string()
}

fn default_openai_model() -> String {
    "gpt-4o-mini".to_string()
}

fn default_openrouter_model() -> String {
    "qwen/qwen-2.5-coder-32b-instruct".to_string()
}

fn default_max_tokens() -> usize {
    4096
}

fn default_temperature() -> f32 {
    0.7
}

fn default_app_name() -> String {
    "cnapse".to_string()
}

fn default_hot_turns() -> usize {
    3
}

fn default_warm_chunks() -> usize {
    10
}

fn default_embedding_model() -> String {
    "local".to_string()
}

fn default_similarity_threshold() -> f32 {
    0.7
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    7777
}

fn default_cors_origins() -> Vec<String> {
    vec!["*".to_string()]
}

fn default_apps_dir() -> String {
    "~/.cnapse/apps".to_string()
}

fn default_max_apps() -> usize {
    50
}

fn default_framework() -> String {
    "vue".to_string()
}

fn default_true() -> bool {
    true
}

// Default implementations
impl Default for GeneralConfig {
    fn default() -> Self {
        Self {
            default_provider: default_provider(),
            log_level: default_log_level(),
            telemetry: false,
        }
    }
}

impl Default for LocalConfig {
    fn default() -> Self {
        Self {
            models_dir: default_models_dir(),
            threads: default_threads(),
            gpu_layers: 0,
            batch_size: default_batch_size(),
            context_size: default_context_size(),
            agents: LocalAgentsConfig::default(),
        }
    }
}

impl Default for LocalAgentsConfig {
    fn default() -> Self {
        Self {
            router: default_router_model(),
            coder: default_coder_model(),
            shell: default_shell_model(),
            filer: default_filer_model(),
            memory: default_memory_model(),
            app: default_app_model(),
        }
    }
}

impl Default for OllamaConfig {
    fn default() -> Self {
        Self {
            url: default_ollama_url(),
            keep_alive: default_keep_alive(),
            agents: OllamaAgentsConfig::default(),
        }
    }
}

impl Default for OllamaAgentsConfig {
    fn default() -> Self {
        Self {
            router: default_ollama_router(),
            coder: default_ollama_coder(),
            shell: default_ollama_shell(),
            filer: default_ollama_filer(),
            memory: default_ollama_memory(),
            app: default_ollama_app(),
        }
    }
}

impl Default for AnthropicConfig {
    fn default() -> Self {
        Self {
            model: default_anthropic_model(),
            max_tokens: default_max_tokens(),
            temperature: default_temperature(),
        }
    }
}

impl Default for OpenAIConfig {
    fn default() -> Self {
        Self {
            model: default_openai_model(),
            max_tokens: default_max_tokens(),
            temperature: default_temperature(),
        }
    }
}

impl Default for OpenRouterConfig {
    fn default() -> Self {
        Self {
            model: default_openrouter_model(),
            max_tokens: default_max_tokens(),
            temperature: default_temperature(),
            site_url: String::new(),
            app_name: default_app_name(),
        }
    }
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            hot_turns: default_hot_turns(),
            warm_chunks: default_warm_chunks(),
            cold_storage: true,
            embedding_model: default_embedding_model(),
            similarity_threshold: default_similarity_threshold(),
        }
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            enable_auth: true,
            cors_origins: default_cors_origins(),
            ssl_cert: String::new(),
            ssl_key: String::new(),
        }
    }
}

impl Default for TelegramConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            allowed_users: Vec::new(),
            webhook_url: String::new(),
        }
    }
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            phone_ip: String::new(),
            vscode_integration: true,
        }
    }
}

impl Default for AppsConfig {
    fn default() -> Self {
        Self {
            storage_dir: default_apps_dir(),
            max_apps: default_max_apps(),
            default_framework: default_framework(),
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            general: GeneralConfig::default(),
            local: LocalConfig::default(),
            ollama: OllamaConfig::default(),
            anthropic: AnthropicConfig::default(),
            openai: OpenAIConfig::default(),
            openrouter: OpenRouterConfig::default(),
            memory: MemoryConfig::default(),
            server: ServerConfig::default(),
            telegram: TelegramConfig::default(),
            sync: SyncConfig::default(),
            apps: AppsConfig::default(),
        }
    }
}

impl Settings {
    /// Load settings from the default path
    pub fn load() -> Result<Self> {
        let paths = Paths::new(None)?;
        Self::load_from(&paths.config)
    }

    /// Load settings from a specific path
    pub fn load_from(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Err(CnapseError::config(
                "Configuration not found. Run 'cnapse init' first.",
            ));
        }

        let content = std::fs::read_to_string(path)
            .map_err(|e| CnapseError::config(format!("Failed to read config: {}", e)))?;

        toml::from_str(&content)
            .map_err(|e| CnapseError::config(format!("Invalid config file: {}", e)))
    }

    /// Save settings to the default path
    pub fn save(&self) -> Result<()> {
        let paths = Paths::new(None)?;
        self.save_to(&paths.config)
    }

    /// Save settings to a specific path
    pub fn save_to(&self, path: &Path) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                CnapseError::filesystem(format!("Failed to create config directory: {}", e))
            })?;
        }

        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)
            .map_err(|e| CnapseError::config(format!("Failed to write config: {}", e)))?;

        Ok(())
    }

    /// Get a configuration value by path (e.g., "local.threads")
    pub fn get(&self, path: &str) -> Option<String> {
        let parts: Vec<&str> = path.split('.').collect();

        // Convert to JSON for generic access
        let json = serde_json::to_value(self).ok()?;

        let mut current = &json;
        for part in parts {
            current = current.get(part)?;
        }

        match current {
            serde_json::Value::String(s) => Some(s.clone()),
            serde_json::Value::Number(n) => Some(n.to_string()),
            serde_json::Value::Bool(b) => Some(b.to_string()),
            serde_json::Value::Array(a) => Some(format!("{:?}", a)),
            _ => Some(current.to_string()),
        }
    }

    /// Set a configuration value by path
    pub fn set(&mut self, path: &str, value: &str) -> Result<()> {
        // Convert to JSON, modify, and convert back
        let mut json = serde_json::to_value(&self)
            .map_err(|e| CnapseError::config(format!("Serialization error: {}", e)))?;

        let parts: Vec<&str> = path.split('.').collect();
        let mut current = &mut json;

        // Navigate to parent
        for (i, part) in parts.iter().enumerate() {
            if i == parts.len() - 1 {
                // Last part - set the value
                if let Some(obj) = current.as_object_mut() {
                    // Try to preserve the type
                    let new_value = if let Ok(n) = value.parse::<i64>() {
                        serde_json::Value::Number(n.into())
                    } else if let Ok(f) = value.parse::<f64>() {
                        serde_json::json!(f)
                    } else if value == "true" {
                        serde_json::Value::Bool(true)
                    } else if value == "false" {
                        serde_json::Value::Bool(false)
                    } else {
                        serde_json::Value::String(value.to_string())
                    };

                    obj.insert(part.to_string(), new_value);
                } else {
                    return Err(CnapseError::config(format!(
                        "Invalid config path: {}",
                        path
                    )));
                }
            } else {
                current = current
                    .get_mut(*part)
                    .ok_or_else(|| CnapseError::config(format!("Invalid config path: {}", path)))?;
            }
        }

        // Convert back
        *self = serde_json::from_value(json)
            .map_err(|e| CnapseError::config(format!("Deserialization error: {}", e)))?;

        Ok(())
    }

    /// Generate default config as TOML string
    pub fn default_toml() -> String {
        toml::to_string_pretty(&Self::default()).expect("Failed to serialize default config")
    }

    /// Get the default provider name
    pub fn get_default_provider(&self) -> &str {
        &self.general.default_provider
    }

    /// Get the default model for the current provider
    pub fn get_default_model(&self) -> String {
        match self.general.default_provider.as_str() {
            "anthropic" => self.anthropic.model.clone(),
            "openai" => self.openai.model.clone(),
            "openrouter" => self.openrouter.model.clone(),
            "ollama" => self.ollama.agents.router.clone(),
            "local" | _ => self.local.agents.router.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_default_settings() {
        let settings = Settings::default();
        assert_eq!(settings.general.default_provider, "local");
        assert_eq!(settings.server.port, 7777);
    }

    #[test]
    fn test_get_set() {
        let mut settings = Settings::default();

        assert_eq!(settings.get("local.threads"), Some("8".to_string()));

        settings.set("local.threads", "16").unwrap();
        assert_eq!(settings.get("local.threads"), Some("16".to_string()));
    }

    #[test]
    fn test_save_load() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("config.toml");

        let mut settings = Settings::default();
        settings.general.default_provider = "anthropic".to_string();
        settings.save_to(&path).unwrap();

        let loaded = Settings::load_from(&path).unwrap();
        assert_eq!(loaded.general.default_provider, "anthropic");
    }
}
