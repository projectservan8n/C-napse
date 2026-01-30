//! Ollama API backend for local inference
//!
//! Ollama provides an easy way to run local LLMs with a simple API.
//! This is the recommended backend for C-napse local inference.

use async_trait::async_trait;
use crate::config::Settings;
use crate::error::{CnapseError, Result};
use super::backend::{InferenceBackend, InferenceRequest, InferenceResponse};
use serde::{Deserialize, Serialize};

const DEFAULT_OLLAMA_URL: &str = "http://127.0.0.1:11434";

/// Ollama backend configuration
#[derive(Debug, Clone)]
pub struct OllamaConfig {
    /// Base URL for Ollama API
    pub base_url: String,
    /// Keep models loaded in memory
    pub keep_alive: Option<String>,
}

impl Default for OllamaConfig {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_OLLAMA_URL.to_string(),
            keep_alive: Some("5m".to_string()),
        }
    }
}

/// Ollama inference backend
pub struct OllamaBackend {
    client: reqwest::Client,
    config: OllamaConfig,
    settings: Settings,
}

#[derive(Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    keep_alive: Option<String>,
}

#[derive(Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    keep_alive: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_predict: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_ctx: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_thread: Option<usize>,
}

#[derive(Deserialize)]
struct OllamaChatResponse {
    message: OllamaMessage,
    #[serde(default)]
    done: bool,
    #[serde(default)]
    total_duration: u64,
    #[serde(default)]
    load_duration: u64,
    #[serde(default)]
    prompt_eval_count: u32,
    #[serde(default)]
    eval_count: u32,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelInfo>,
}

#[derive(Deserialize)]
struct OllamaModelInfo {
    name: String,
    size: u64,
    #[serde(default)]
    details: OllamaModelDetails,
}

#[derive(Deserialize, Default)]
struct OllamaModelDetails {
    #[serde(default)]
    parameter_size: String,
    #[serde(default)]
    quantization_level: String,
}

impl OllamaBackend {
    /// Create a new Ollama backend with default configuration
    pub fn new(settings: Settings) -> Self {
        Self::with_config(settings, OllamaConfig::default())
    }

    /// Create a new Ollama backend with custom configuration
    pub fn with_config(settings: Settings, config: OllamaConfig) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(300)) // 5 min timeout for slow models
                .build()
                .expect("Failed to create HTTP client"),
            config,
            settings,
        }
    }

    /// Create backend for a specific Ollama instance URL
    pub fn with_url(settings: Settings, url: &str) -> Self {
        Self::with_config(
            settings,
            OllamaConfig {
                base_url: url.to_string(),
                ..Default::default()
            },
        )
    }

    /// Pull a model from Ollama registry
    pub async fn pull_model(&self, model: &str) -> Result<()> {
        let url = format!("{}/api/pull", self.config.base_url);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({
                "name": model,
                "stream": false
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(CnapseError::model(format!("Failed to pull model: {}", text)));
        }

        Ok(())
    }

    /// Delete a model from Ollama
    pub async fn delete_model(&self, model: &str) -> Result<()> {
        let url = format!("{}/api/delete", self.config.base_url);

        let response = self
            .client
            .delete(&url)
            .json(&serde_json::json!({ "name": model }))
            .send()
            .await?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(CnapseError::model(format!("Failed to delete model: {}", text)));
        }

        Ok(())
    }

    /// Get model information
    pub async fn model_info(&self, model: &str) -> Result<serde_json::Value> {
        let url = format!("{}/api/show", self.config.base_url);

        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "name": model }))
            .send()
            .await?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(CnapseError::model(format!("Failed to get model info: {}", text)));
        }

        response.json().await.map_err(|e| CnapseError::model(e.to_string()))
    }

    /// Check if a specific model is available
    pub async fn has_model(&self, model: &str) -> bool {
        self.model_info(model).await.is_ok()
    }
}

#[async_trait]
impl InferenceBackend for OllamaBackend {
    fn name(&self) -> &'static str {
        "ollama"
    }

    async fn is_available(&self) -> bool {
        let url = format!("{}/api/tags", self.config.base_url);

        self.client
            .get(&url)
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        let url = format!("{}/api/chat", self.config.base_url);

        // Convert messages to Ollama format
        let messages: Vec<OllamaMessage> = request
            .messages
            .iter()
            .map(|m| {
                let role = match m.role {
                    crate::agents::MessageRole::System => "system",
                    crate::agents::MessageRole::User => "user",
                    crate::agents::MessageRole::Assistant => "assistant",
                    crate::agents::MessageRole::Tool => "user", // Ollama doesn't have tool role
                };
                OllamaMessage {
                    role: role.to_string(),
                    content: m.content.clone(),
                }
            })
            .collect();

        let ollama_request = OllamaChatRequest {
            model: request.model.clone(),
            messages,
            stream: false,
            options: Some(OllamaOptions {
                temperature: Some(request.temperature),
                num_predict: Some(request.max_tokens),
                top_p: None,
                stop: if request.stop.is_empty() {
                    None
                } else {
                    Some(request.stop.clone())
                },
                num_ctx: Some(self.settings.local.context_size),
                num_thread: Some(self.settings.local.threads),
            }),
            keep_alive: self.config.keep_alive.clone(),
        };

        let response = self
            .client
            .post(&url)
            .json(&ollama_request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();

            // Check for specific error cases
            if text.contains("model") && text.contains("not found") {
                return Err(CnapseError::model(format!(
                    "Model '{}' not found. Pull it with: ollama pull {}",
                    request.model, request.model
                )));
            }

            return Err(CnapseError::inference(format!("{}: {}", status, text)));
        }

        let result: OllamaChatResponse = response.json().await?;

        Ok(InferenceResponse {
            content: result.message.content,
            input_tokens: result.prompt_eval_count,
            output_tokens: result.eval_count,
            stop_reason: if result.done {
                Some("stop".to_string())
            } else {
                None
            },
            model: request.model,
        })
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/api/tags", self.config.base_url);

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(CnapseError::inference("Failed to list models from Ollama"));
        }

        let result: OllamaTagsResponse = response.json().await?;

        Ok(result.models.into_iter().map(|m| m.name).collect())
    }
}

/// Recommended small models for C-napse agents
pub mod recommended_models {
    /// Router agent - fast intent classification
    pub const ROUTER: &str = "qwen2.5:0.5b";

    /// Coder agent - code generation
    pub const CODER: &str = "qwen2.5-coder:1.5b";

    /// Shell agent - command generation
    pub const SHELL: &str = "qwen2.5:0.5b";

    /// Filer agent - file operations
    pub const FILER: &str = "qwen2.5:0.5b";

    /// Memory agent - summarization
    pub const MEMORY: &str = "qwen2.5:0.5b";

    /// App agent - web app generation
    pub const APP: &str = "qwen2.5-coder:1.5b";

    /// All recommended models for easy installation
    pub const ALL: &[&str] = &[
        "qwen2.5:0.5b",
        "qwen2.5-coder:1.5b",
    ];
}

/// Check system requirements for running Ollama models
pub fn check_system_requirements() -> SystemRequirements {
    let sys = sysinfo::System::new_all();

    let total_ram_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let available_ram_gb = sys.available_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let cpu_count = sys.cpus().len();

    // Estimate what models can run
    let can_run_05b = available_ram_gb >= 1.0;
    let can_run_1_5b = available_ram_gb >= 2.0;
    let can_run_3b = available_ram_gb >= 4.0;
    let can_run_7b = available_ram_gb >= 8.0;

    // Estimate concurrent model capacity
    let concurrent_small_models = (available_ram_gb / 1.0).floor() as usize;

    SystemRequirements {
        total_ram_gb,
        available_ram_gb,
        cpu_count,
        can_run_05b,
        can_run_1_5b,
        can_run_3b,
        can_run_7b,
        concurrent_small_models: concurrent_small_models.min(6), // Max 6 agents
        recommended_config: if can_run_1_5b {
            "Full local inference with Qwen2.5 models"
        } else if can_run_05b {
            "Limited local inference with 0.5B models only"
        } else {
            "Insufficient RAM - use cloud API instead"
        },
    }
}

#[derive(Debug)]
pub struct SystemRequirements {
    pub total_ram_gb: f64,
    pub available_ram_gb: f64,
    pub cpu_count: usize,
    pub can_run_05b: bool,
    pub can_run_1_5b: bool,
    pub can_run_3b: bool,
    pub can_run_7b: bool,
    pub concurrent_small_models: usize,
    pub recommended_config: &'static str,
}

impl std::fmt::Display for SystemRequirements {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "System Requirements Check")?;
        writeln!(f, "========================")?;
        writeln!(f, "Total RAM:     {:.1} GB", self.total_ram_gb)?;
        writeln!(f, "Available RAM: {:.1} GB", self.available_ram_gb)?;
        writeln!(f, "CPU Cores:     {}", self.cpu_count)?;
        writeln!(f)?;
        writeln!(f, "Model Compatibility:")?;
        writeln!(f, "  0.5B models: {}", if self.can_run_05b { "✓" } else { "✗" })?;
        writeln!(f, "  1.5B models: {}", if self.can_run_1_5b { "✓" } else { "✗" })?;
        writeln!(f, "  3B models:   {}", if self.can_run_3b { "✓" } else { "✗" })?;
        writeln!(f, "  7B models:   {}", if self.can_run_7b { "✓" } else { "✗" })?;
        writeln!(f)?;
        writeln!(f, "Concurrent small models: {}", self.concurrent_small_models)?;
        writeln!(f, "Recommendation: {}", self.recommended_config)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_system_requirements() {
        let reqs = check_system_requirements();
        println!("{}", reqs);
        assert!(reqs.cpu_count > 0);
    }
}
