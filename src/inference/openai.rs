//! OpenAI API backend

use async_trait::async_trait;
use secrecy::ExposeSecret;
use crate::config::{Credentials, Settings};
use crate::error::CnapseError;
use super::backend::{InferenceBackend, InferenceRequest, InferenceResponse};

const API_URL: &str = "https://api.openai.com/v1/chat/completions";

pub struct OpenAIBackend {
    client: reqwest::Client,
    settings: Settings,
}

impl OpenAIBackend {
    pub fn new(settings: Settings) -> Result<Self, CnapseError> {
        Ok(Self {
            client: reqwest::Client::new(),
            settings,
        })
    }
}

#[async_trait]
impl InferenceBackend for OpenAIBackend {
    fn name(&self) -> &'static str {
        "openai"
    }

    async fn is_available(&self) -> bool {
        Credentials::load()
            .map(|c| c.has_credentials("openai"))
            .unwrap_or(false)
    }

    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, CnapseError> {
        let credentials = Credentials::load()?;
        let api_key = credentials
            .get_api_key("openai")
            .ok_or_else(|| CnapseError::auth("No OpenAI API key configured"))?;

        // Convert messages to OpenAI format
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

        let response = self
            .client
            .post(API_URL)
            .header("Authorization", format!("Bearer {}", api_key.expose_secret()))
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(CnapseError::api("openai", format!("{}: {}", status, text)));
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
        let credentials = Credentials::load()?;
        let api_key = credentials
            .get_api_key("openai")
            .ok_or_else(|| CnapseError::auth("No OpenAI API key configured"))?;

        let response = self
            .client
            .get("https://api.openai.com/v1/models")
            .header("Authorization", format!("Bearer {}", api_key.expose_secret()))
            .send()
            .await?;

        if !response.status().is_success() {
            // Return default models if API fails
            return Ok(vec![
                "gpt-4o".to_string(),
                "gpt-4o-mini".to_string(),
                "gpt-4-turbo".to_string(),
                "gpt-3.5-turbo".to_string(),
            ]);
        }

        let result: serde_json::Value = response.json().await?;
        let models: Vec<String> = result["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                    .filter(|id| id.starts_with("gpt"))
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    }
}
