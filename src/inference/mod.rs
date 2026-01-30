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
