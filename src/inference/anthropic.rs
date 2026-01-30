//! Anthropic Claude API backend

use async_trait::async_trait;
use secrecy::ExposeSecret;
use crate::config::{Credentials, Settings};
use crate::error::CnapseError;
use super::backend::{InferenceBackend, InferenceRequest, InferenceResponse};

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

pub struct AnthropicBackend {
    client: reqwest::Client,
    settings: Settings,
}

impl AnthropicBackend {
    pub fn new(settings: Settings) -> Self {
        Self {
            client: reqwest::Client::new(),
            settings,
        }
    }
}

#[async_trait]
impl InferenceBackend for AnthropicBackend {
    fn name(&self) -> &'static str {
        "anthropic"
    }

    async fn is_available(&self) -> bool {
        Credentials::load()
            .map(|c| c.has_credentials("anthropic"))
            .unwrap_or(false)
    }

    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, CnapseError> {
        let credentials = Credentials::load()?;
        let api_key = credentials
            .get_api_key("anthropic")
            .ok_or_else(|| CnapseError::auth("No Anthropic API key configured"))?;

        // Convert messages to Anthropic format
        let mut system_prompt = String::new();
        let messages: Vec<serde_json::Value> = request
            .messages
            .iter()
            .filter_map(|m| {
                match m.role {
                    crate::agents::MessageRole::System => {
                        system_prompt = m.content.clone();
                        None
                    }
                    crate::agents::MessageRole::User => Some(serde_json::json!({
                        "role": "user",
                        "content": m.content
                    })),
                    crate::agents::MessageRole::Assistant => Some(serde_json::json!({
                        "role": "assistant",
                        "content": m.content
                    })),
                    crate::agents::MessageRole::Tool => None, // Handle tools differently
                }
            })
            .collect();

        let mut body = serde_json::json!({
            "model": request.model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "messages": messages,
        });

        if !system_prompt.is_empty() {
            body["system"] = serde_json::Value::String(system_prompt);
        }

        if !request.stop.is_empty() {
            body["stop_sequences"] = serde_json::json!(request.stop);
        }

        let response = self
            .client
            .post(API_URL)
            .header("x-api-key", api_key.expose_secret())
            .header("anthropic-version", API_VERSION)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(CnapseError::api("anthropic", format!("{}: {}", status, text)));
        }

        let result: serde_json::Value = response.json().await?;

        let content = result["content"][0]["text"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let input_tokens = result["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
        let output_tokens = result["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;
        let stop_reason = result["stop_reason"].as_str().map(|s| s.to_string());

        Ok(InferenceResponse {
            content,
            input_tokens,
            output_tokens,
            stop_reason,
            model: request.model,
        })
    }

    async fn list_models(&self) -> Result<Vec<String>, CnapseError> {
        // Anthropic doesn't have a models endpoint, return known models
        Ok(vec![
            "claude-opus-4-20250514".to_string(),
            "claude-sonnet-4-20250514".to_string(),
            "claude-3-5-sonnet-20241022".to_string(),
            "claude-3-5-haiku-20241022".to_string(),
            "claude-3-haiku-20240307".to_string(),
        ])
    }
}
