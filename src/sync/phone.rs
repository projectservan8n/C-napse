//! Phone sync protocol

use crate::error::{CnapseError, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Phone sync configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub phone_ip: String,
    pub phone_port: u16,
    pub sync_dir: PathBuf,
    pub watch_patterns: Vec<String>,
}

/// Sync message types
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncMessage {
    #[serde(rename = "file_changed")]
    FileChanged { path: String, content: String },

    #[serde(rename = "file_deleted")]
    FileDeleted { path: String },

    #[serde(rename = "command_request")]
    CommandRequest { cmd: String },

    #[serde(rename = "command_response")]
    CommandResponse { output: String, code: i32 },

    #[serde(rename = "ollama_forward")]
    OllamaForward { model: String, prompt: String },

    #[serde(rename = "ollama_response")]
    OllamaResponse { response: String },

    #[serde(rename = "ping")]
    Ping,

    #[serde(rename = "pong")]
    Pong,
}

/// Phone sync client
pub struct PhoneSync {
    config: SyncConfig,
}

impl PhoneSync {
    /// Create a new phone sync client
    pub fn new(config: SyncConfig) -> Self {
        Self { config }
    }

    /// Connect to phone
    pub async fn connect(&self) -> Result<()> {
        let addr = format!("{}:{}", self.config.phone_ip, self.config.phone_port);
        tracing::info!("Connecting to phone at {}", addr);

        // TODO: Implement WebSocket connection
        Err(CnapseError::network("Phone sync not yet implemented"))
    }

    /// Send a message to phone
    pub async fn send(&self, _msg: SyncMessage) -> Result<()> {
        // TODO: Implement send
        Err(CnapseError::network("Phone sync not yet implemented"))
    }

    /// Start sync loop
    pub async fn start_sync(&self) -> Result<()> {
        // TODO: Implement sync loop
        // 1. Watch local files for changes
        // 2. Connect to phone
        // 3. Bidirectional sync

        Err(CnapseError::network("Phone sync not yet implemented"))
    }
}

/// Check if phone is reachable
pub async fn ping_phone(ip: &str, port: u16) -> Result<bool> {
    use std::net::TcpStream;
    use std::time::Duration;

    let addr = format!("{}:{}", ip, port);
    let timeout = Duration::from_secs(5);

    match TcpStream::connect_timeout(&addr.parse().unwrap(), timeout) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
