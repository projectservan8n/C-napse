//! OpenRouter API backend

use super::backend::{InferenceBackend, InferenceRequest, InferenceResponse};
use crate::config::{Credentials, Settings};
use crate::error::CnapseError;
use async_trait::async_trait;
use secrecy::ExposeSecret;

const API_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

pub struct OpenRouterBackend {
    client: reqwest::Client,
    settings: Settings,
}

impl OpenRouterBackend {
    pub fn new(settings: Settings) -> Result<Self, CnapseError> {
        Ok(Self {
            client: reqwest::Client::new(),
            settings,
        })
    }
}

#[async_trait]
impl InferenceBackend for OpenRouterBackend {
    fn name(&self) -> &'static str {
        "openrouter"
    }

    async fn is_available(&self) -> bool {
        Credentials::load()
            .map(|c| c.has_credentials("openrouter"))
            .unwrap_or(false)
    }

    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, CnapseError> {
        let credentials = Credentials::load()?;
        let api_key = credentials
            .get_api_key("openrouter")
            .ok_or_else(|| CnapseError::auth("No OpenRouter API key configured"))?;

        // Convert messages to OpenAI format (OpenRouter is compatible)
        let messages: Vec<serde_json::Value> = request
            .messages
            .iter()
            .map(|m| {
                let role = match m.role {
                    crate::agents::MessageRole::System => "system",
                    crate::agents::MessageRole::User => "user",
                    crate::agents::MessageRole::Assistant => "assistant",
                    crate::agents::MessageRole::Tool => "tool",
                };
                serde_json::json!({
                    "role": role,
                    "content": m.content
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "model": request.model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "messages": messages,
        });

        if !request.stop.is_empty() {
            body["stop"] = serde_json::json!(request.stop);
        }

        let mut req = self
            .client
            .post(API_URL)
            .header(
                "Authorization",
                format!("Bearer {}", api_key.expose_secret()),
            )
            .header("content-type", "application/json")
            .header("HTTP-Referer", &self.settings.openrouter.site_url)
            .header("X-Title", &self.settings.openrouter.app_name);

        let response = req.json(&body).send().await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(CnapseError::api(
                "openrouter",
                format!("{}: {}", status, text),
            ));
        }

        let result: serde_json::Value = response.json().await?;

        let content = result["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let input_tokens = result["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
        let output_tokens = result["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
        let stop_reason = result["choices"][0]["finish_reason"]
            .as_str()
            .map(|s| s.to_string());

        Ok(InferenceResponse {
            content,
            input_tokens,
            output_tokens,
            stop_reason,
            model: request.model,
        })
    }

    async fn list_models(&self) -> Result<Vec<String>, CnapseError> {
        // Return popular models available on OpenRouter
        Ok(vec![
            "qwen/qwen-2.5-coder-32b-instruct".to_string(),
            "qwen/qwen-2.5-72b-instruct".to_string(),
            "anthropic/claude-3.5-sonnet".to_string(),
            "openai/gpt-4o".to_string(),
            "openai/gpt-4o-mini".to_string(),
            "google/gemini-pro-1.5".to_string(),
            "meta-llama/llama-3.1-70b-instruct".to_string(),
            "mistralai/mixtral-8x22b-instruct".to_string(),
        ])
    }
}
