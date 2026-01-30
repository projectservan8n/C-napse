//! Configuration management for C-napse

mod credentials;
mod paths;
mod settings;

pub use credentials::Credentials;
pub use paths::Paths;
pub use settings::Settings;

// Re-export sub-config modules
pub use settings::{
    AnthropicConfig, AppsConfig, GeneralConfig, LocalAgentsConfig, LocalConfig, MemoryConfig,
    OpenAIConfig, OpenRouterConfig, ServerConfig, SyncConfig, TelegramConfig,
};
