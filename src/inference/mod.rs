//! Inference backends for C-napse
//!
//! Supports local inference via Ollama and cloud APIs (Anthropic, OpenAI, OpenRouter)

pub mod backend;
pub mod local;
pub mod ollama;
pub mod anthropic;
pub mod openai;
pub mod openrouter;

pub use backend::{InferenceBackend, InferenceRequest, InferenceResponse};
pub use ollama::{OllamaBackend, OllamaConfig, check_system_requirements, recommended_models};

use crate::config::Settings;
use crate::error::Result;
use std::sync::Arc;

/// Create an inference backend based on settings
pub async fn create_backend(settings: &Settings) -> Result<Arc<dyn InferenceBackend + Send + Sync>> {
    match settings.general.default_provider.as_str() {
        "ollama" => {
            let backend = OllamaBackend::with_url(settings.clone(), &settings.ollama.url);
            Ok(Arc::new(backend))
        }
        "anthropic" => {
            let backend = anthropic::AnthropicBackend::new(settings.clone())?;
            Ok(Arc::new(backend))
        }
        "openai" => {
            let backend = openai::OpenAIBackend::new(settings.clone())?;
            Ok(Arc::new(backend))
        }
        "openrouter" => {
            let backend = openrouter::OpenRouterBackend::new(settings.clone())?;
            Ok(Arc::new(backend))
        }
        "local" | _ => {
            // Default to Ollama for local
            let backend = OllamaBackend::new(settings.clone());
            Ok(Arc::new(backend))
        }
    }
}
