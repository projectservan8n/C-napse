//! Inference backends for C-napse
//!
//! Supports local inference (llama.cpp) and cloud APIs (Anthropic, OpenAI, OpenRouter)

pub mod backend;
pub mod local;
pub mod anthropic;
pub mod openai;
pub mod openrouter;

pub use backend::{InferenceBackend, InferenceRequest, InferenceResponse};
