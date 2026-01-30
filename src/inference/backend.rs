//! Inference backend trait and types

use async_trait::async_trait;
use crate::agents::AgentMessage;
use crate::error::CnapseError;
use serde::{Deserialize, Serialize};

/// Request for inference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    /// Messages in the conversation
    pub messages: Vec<AgentMessage>,
    /// Model to use (provider-specific)
    pub model: String,
    /// Maximum tokens to generate
    pub max_tokens: usize,
    /// Temperature for sampling
    pub temperature: f32,
    /// Stop sequences
    #[serde(default)]
    pub stop: Vec<String>,
    /// Whether to stream the response
    #[serde(default)]
    pub stream: bool,
}

/// Response from inference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    /// Generated text content
    pub content: String,
    /// Number of input tokens used
    pub input_tokens: u32,
    /// Number of output tokens generated
    pub output_tokens: u32,
    /// Stop reason
    pub stop_reason: Option<String>,
    /// Model used
    pub model: String,
}

/// Trait for inference backends
#[async_trait]
pub trait InferenceBackend: Send + Sync {
    /// Get the backend name
    fn name(&self) -> &'static str;

    /// Check if the backend is available
    async fn is_available(&self) -> bool;

    /// Perform inference
    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, CnapseError>;

    /// List available models
    async fn list_models(&self) -> Result<Vec<String>, CnapseError>;
}
