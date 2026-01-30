//! Secure credentials management for C-napse

use crate::config::Paths;
use crate::error::{CnapseError, Result};
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// API credentials storage
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Credentials {
    #[serde(default)]
    pub anthropic: ProviderCredentials,

    #[serde(default)]
    pub openai: ProviderCredentials,

    #[serde(default)]
    pub openrouter: ProviderCredentials,

    #[serde(default)]
    pub telegram: TelegramCredentials,

    #[serde(default)]
    pub server: ServerCredentials,
}

/// Credentials for a single API provider
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProviderCredentials {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
}

/// Telegram bot credentials
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TelegramCredentials {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bot_token: Option<String>,
}

/// Server API credentials
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ServerCredentials {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
}

impl Credentials {
    /// Load credentials from the default path
    pub fn load() -> Result<Self> {
        let paths = Paths::new(None)?;
        Self::load_from(&paths.credentials)
    }

    /// Load credentials from a specific path
    pub fn load_from(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }

        let content = std::fs::read_to_string(path)
            .map_err(|e| CnapseError::config(format!("Failed to read credentials: {}", e)))?;

        toml::from_str(&content).map_err(|e| CnapseError::config(format!("Invalid credentials file: {}", e)))
    }

    /// Save credentials to the default path
    pub fn save(&self) -> Result<()> {
        let paths = Paths::new(None)?;
        self.save_to(&paths.credentials)
    }

    /// Save credentials to a specific path
    pub fn save_to(&self, path: &Path) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                CnapseError::filesystem(format!("Failed to create credentials directory: {}", e))
            })?;
        }

        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)
            .map_err(|e| CnapseError::config(format!("Failed to write credentials: {}", e)))?;

        // Set restrictive permissions on Unix
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = std::fs::metadata(path)?.permissions();
            perms.set_mode(0o600);
            std::fs::set_permissions(path, perms)?;
        }

        Ok(())
    }

    /// Get API key for a provider
    pub fn get_api_key(&self, provider: &str) -> Option<SecretString> {
        let key = match provider.to_lowercase().as_str() {
            "anthropic" => self.anthropic.api_key.as_ref(),
            "openai" => self.openai.api_key.as_ref(),
            "openrouter" => self.openrouter.api_key.as_ref(),
            _ => None,
        };

        key.map(|k| SecretString::new(k.clone().into()))
    }

    /// Set API key for a provider
    pub fn set_api_key(&mut self, provider: &str, key: &str) -> Result<()> {
        match provider.to_lowercase().as_str() {
            "anthropic" => self.anthropic.api_key = Some(key.to_string()),
            "openai" => self.openai.api_key = Some(key.to_string()),
            "openrouter" => self.openrouter.api_key = Some(key.to_string()),
            _ => return Err(CnapseError::config(format!("Unknown provider: {}", provider))),
        }
        Ok(())
    }

    /// Remove API key for a provider
    pub fn remove_api_key(&mut self, provider: &str) -> Result<()> {
        match provider.to_lowercase().as_str() {
            "anthropic" => self.anthropic.api_key = None,
            "openai" => self.openai.api_key = None,
            "openrouter" => self.openrouter.api_key = None,
            _ => return Err(CnapseError::config(format!("Unknown provider: {}", provider))),
        }
        Ok(())
    }

    /// Check if a provider has credentials configured
    pub fn has_credentials(&self, provider: &str) -> bool {
        match provider.to_lowercase().as_str() {
            "anthropic" => self.anthropic.api_key.is_some(),
            "openai" => self.openai.api_key.is_some(),
            "openrouter" => self.openrouter.api_key.is_some(),
            "telegram" => self.telegram.bot_token.is_some(),
            _ => false,
        }
    }

    /// List all configured providers
    pub fn list_configured_providers(&self) -> Vec<&'static str> {
        let mut providers = Vec::new();
        if self.anthropic.api_key.is_some() {
            providers.push("anthropic");
        }
        if self.openai.api_key.is_some() {
            providers.push("openai");
        }
        if self.openrouter.api_key.is_some() {
            providers.push("openrouter");
        }
        providers
    }

    /// Get masked version of API key for display
    pub fn get_masked_key(&self, provider: &str) -> Option<String> {
        let key = match provider.to_lowercase().as_str() {
            "anthropic" => self.anthropic.api_key.as_ref(),
            "openai" => self.openai.api_key.as_ref(),
            "openrouter" => self.openrouter.api_key.as_ref(),
            _ => None,
        };

        key.map(|k| {
            if k.len() > 8 {
                format!("{}...{}", &k[..4], &k[k.len() - 4..])
            } else {
                "****".to_string()
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_set_get_api_key() {
        let mut creds = Credentials::default();
        creds.set_api_key("anthropic", "sk-ant-test123").unwrap();

        let key = creds.get_api_key("anthropic").unwrap();
        assert_eq!(key.expose_secret(), "sk-ant-test123");
    }

    #[test]
    fn test_masked_key() {
        let mut creds = Credentials::default();
        creds.set_api_key("openai", "sk-1234567890abcdef").unwrap();

        let masked = creds.get_masked_key("openai").unwrap();
        assert_eq!(masked, "sk-1...cdef");
    }

    #[test]
    fn test_save_load() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("credentials.toml");

        let mut creds = Credentials::default();
        creds.set_api_key("anthropic", "test-key").unwrap();
        creds.save_to(&path).unwrap();

        let loaded = Credentials::load_from(&path).unwrap();
        assert!(loaded.has_credentials("anthropic"));
    }
}
