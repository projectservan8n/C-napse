//! Custom error types for C-napse

use thiserror::Error;

/// Main error type for C-napse operations
#[derive(Error, Debug)]
pub enum CnapseError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Inference error: {0}")]
    Inference(String),

    #[error("Agent error: {0}")]
    Agent(String),

    #[error("Tool execution error: {0}")]
    Tool(String),

    #[error("Memory/storage error: {0}")]
    Memory(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("File system error: {0}")]
    FileSystem(String),

    #[error("Model error: {0}")]
    Model(String),

    #[error("API error ({provider}): {message}")]
    Api { provider: String, message: String },

    #[error("Rate limit exceeded for {provider}")]
    RateLimit { provider: String },

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("Cancelled")]
    Cancelled,

    #[error(transparent)]
    Io(#[from] std::io::Error),

    #[error(transparent)]
    Serialization(#[from] serde_json::Error),

    #[error(transparent)]
    TomlSerialization(#[from] toml::ser::Error),

    #[error(transparent)]
    TomlDeserialization(#[from] toml::de::Error),

    #[error(transparent)]
    Database(#[from] rusqlite::Error),

    #[error(transparent)]
    Request(#[from] reqwest::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

impl CnapseError {
    /// Create a config error
    pub fn config(msg: impl Into<String>) -> Self {
        Self::Config(msg.into())
    }

    /// Create an auth error
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    /// Create an inference error
    pub fn inference(msg: impl Into<String>) -> Self {
        Self::Inference(msg.into())
    }

    /// Create an agent error
    pub fn agent(msg: impl Into<String>) -> Self {
        Self::Agent(msg.into())
    }

    /// Create a tool error
    pub fn tool(msg: impl Into<String>) -> Self {
        Self::Tool(msg.into())
    }

    /// Create a memory error
    pub fn memory(msg: impl Into<String>) -> Self {
        Self::Memory(msg.into())
    }

    /// Create a network error
    pub fn network(msg: impl Into<String>) -> Self {
        Self::Network(msg.into())
    }

    /// Create a file system error
    pub fn filesystem(msg: impl Into<String>) -> Self {
        Self::FileSystem(msg.into())
    }

    /// Create a model error
    pub fn model(msg: impl Into<String>) -> Self {
        Self::Model(msg.into())
    }

    /// Create an API error
    pub fn api(provider: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Api {
            provider: provider.into(),
            message: message.into(),
        }
    }

    /// Create a rate limit error
    pub fn rate_limit(provider: impl Into<String>) -> Self {
        Self::RateLimit {
            provider: provider.into(),
        }
    }

    /// Create an invalid input error
    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self::InvalidInput(msg.into())
    }

    /// Create a not found error
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    /// Create a permission denied error
    pub fn permission_denied(msg: impl Into<String>) -> Self {
        Self::PermissionDenied(msg.into())
    }

    /// Create a timeout error
    pub fn timeout(msg: impl Into<String>) -> Self {
        Self::Timeout(msg.into())
    }

    /// Check if this error is retryable
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            Self::Network(_) | Self::Timeout(_) | Self::RateLimit { .. }
        )
    }

    /// Get error code for API responses
    pub fn error_code(&self) -> &'static str {
        match self {
            Self::Config(_) => "CONFIG_ERROR",
            Self::Auth(_) => "AUTH_ERROR",
            Self::Inference(_) => "INFERENCE_ERROR",
            Self::Agent(_) => "AGENT_ERROR",
            Self::Tool(_) => "TOOL_ERROR",
            Self::Memory(_) => "MEMORY_ERROR",
            Self::Network(_) => "NETWORK_ERROR",
            Self::FileSystem(_) => "FILESYSTEM_ERROR",
            Self::Model(_) => "MODEL_ERROR",
            Self::Api { .. } => "API_ERROR",
            Self::RateLimit { .. } => "RATE_LIMIT",
            Self::InvalidInput(_) => "INVALID_INPUT",
            Self::NotFound(_) => "NOT_FOUND",
            Self::PermissionDenied(_) => "PERMISSION_DENIED",
            Self::Timeout(_) => "TIMEOUT",
            Self::Cancelled => "CANCELLED",
            Self::Io(_) => "IO_ERROR",
            Self::Serialization(_) => "SERIALIZATION_ERROR",
            Self::TomlSerialization(_) => "SERIALIZATION_ERROR",
            Self::TomlDeserialization(_) => "DESERIALIZATION_ERROR",
            Self::Database(_) => "DATABASE_ERROR",
            Self::Request(_) => "REQUEST_ERROR",
            Self::Other(_) => "UNKNOWN_ERROR",
        }
    }
}

/// Result type alias for C-napse operations
pub type Result<T> = std::result::Result<T, CnapseError>;
