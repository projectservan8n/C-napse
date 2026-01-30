//! Local inference backend using llama.cpp

use async_trait::async_trait;
use crate::config::Settings;
use crate::error::CnapseError;
use super::backend::{InferenceBackend, InferenceRequest, InferenceResponse};

pub struct LocalBackend {
    settings: Settings,
}

impl LocalBackend {
    pub fn new(settings: Settings) -> Self {
        Self { settings }
    }
}

#[async_trait]
impl InferenceBackend for LocalBackend {
    fn name(&self) -> &'static str {
        "local"
    }

    async fn is_available(&self) -> bool {
        // Check if any models are available
        let paths = match crate::config::Paths::new(None) {
            Ok(p) => p,
            Err(_) => return false,
        };

        paths.list_models().map(|m| !m.is_empty()).unwrap_or(false)
    }

    async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, CnapseError> {
        // TODO: Implement actual llama.cpp inference
        // This is a placeholder that returns an error

        Err(CnapseError::inference(
            "Local inference not yet implemented. Please use a cloud provider or download models."
        ))
    }

    async fn list_models(&self) -> Result<Vec<String>, CnapseError> {
        let paths = crate::config::Paths::new(None)?;
        let models = paths.list_models()?;

        Ok(models
            .into_iter()
            .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
            .collect())
    }
}
