//! Path management for C-napse configuration and data

use crate::error::{CnapseError, Result};
use std::path::PathBuf;

/// Manages all C-napse paths
#[derive(Debug, Clone)]
pub struct Paths {
    /// Root config directory (~/.cnapse)
    pub root: PathBuf,
    /// Main configuration file
    pub config: PathBuf,
    /// Credentials file
    pub credentials: PathBuf,
    /// Models directory
    pub models: PathBuf,
    /// Apps directory
    pub apps: PathBuf,
    /// Memory database
    pub memory_db: PathBuf,
    /// Embeddings database
    pub embeddings_db: PathBuf,
    /// Logs directory
    pub logs: PathBuf,
}

impl Paths {
    /// Create paths instance, optionally using a custom root
    pub fn new(custom_root: Option<PathBuf>) -> Result<Self> {
        let root = if let Some(path) = custom_root {
            path
        } else {
            Self::default_root()?
        };

        Ok(Self {
            config: root.join("config.toml"),
            credentials: root.join("credentials.toml"),
            models: root.join("models"),
            apps: root.join("apps"),
            memory_db: root.join("memory.db"),
            embeddings_db: root.join("embeddings.db"),
            logs: root.join("logs"),
            root,
        })
    }

    /// Get the default root directory (~/.cnapse)
    pub fn default_root() -> Result<PathBuf> {
        dirs::home_dir()
            .map(|h| h.join(".cnapse"))
            .ok_or_else(|| CnapseError::config("Could not determine home directory"))
    }

    /// Check if C-napse has been initialized
    pub fn is_initialized(&self) -> bool {
        self.config.exists()
    }

    /// Create all necessary directories
    pub fn ensure_dirs(&self) -> Result<()> {
        let dirs = [&self.root, &self.models, &self.apps, &self.logs];

        for dir in dirs {
            if !dir.exists() {
                std::fs::create_dir_all(dir).map_err(|e| {
                    CnapseError::filesystem(format!("Failed to create directory {:?}: {}", dir, e))
                })?;
            }
        }

        Ok(())
    }

    /// Get path to a specific model file
    pub fn model_path(&self, model_name: &str) -> PathBuf {
        self.models.join(model_name)
    }

    /// Get path to a specific app directory
    pub fn app_path(&self, app_id: &str) -> PathBuf {
        self.apps.join(app_id)
    }

    /// Get path to today's log file
    pub fn log_file(&self) -> PathBuf {
        let today = chrono::Local::now().format("%Y-%m-%d");
        self.logs.join(format!("cnapse-{}.log", today))
    }

    /// List all model files in the models directory
    pub fn list_models(&self) -> Result<Vec<PathBuf>> {
        if !self.models.exists() {
            return Ok(Vec::new());
        }

        let entries = std::fs::read_dir(&self.models).map_err(|e| {
            CnapseError::filesystem(format!("Failed to read models directory: {}", e))
        })?;

        let models: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.extension()
                    .map(|ext| ext == "gguf" || ext == "bin")
                    .unwrap_or(false)
            })
            .collect();

        Ok(models)
    }

    /// List all app directories
    pub fn list_apps(&self) -> Result<Vec<PathBuf>> {
        if !self.apps.exists() {
            return Ok(Vec::new());
        }

        let entries = std::fs::read_dir(&self.apps)
            .map_err(|e| CnapseError::filesystem(format!("Failed to read apps directory: {}", e)))?;

        let apps: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.is_dir() && p.join("manifest.json").exists())
            .collect();

        Ok(apps)
    }
}

impl Default for Paths {
    fn default() -> Self {
        Self::new(None).expect("Failed to determine default paths")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_custom_root() {
        let tmp = TempDir::new().unwrap();
        let paths = Paths::new(Some(tmp.path().to_path_buf())).unwrap();
        assert_eq!(paths.root, tmp.path());
        assert_eq!(paths.config, tmp.path().join("config.toml"));
    }

    #[test]
    fn test_ensure_dirs() {
        let tmp = TempDir::new().unwrap();
        let paths = Paths::new(Some(tmp.path().to_path_buf())).unwrap();
        paths.ensure_dirs().unwrap();

        assert!(paths.root.exists());
        assert!(paths.models.exists());
        assert!(paths.apps.exists());
        assert!(paths.logs.exists());
    }
}
