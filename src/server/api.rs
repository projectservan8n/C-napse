//! REST API handlers

use axum::{
    extract::Json,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

#[derive(Serialize)]
pub struct StatusResponse {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub memory_mb: u64,
}

#[derive(Deserialize)]
pub struct ChatRequest {
    pub message: String,
    pub provider: Option<String>,
    pub agent: Option<String>,
    pub stream: Option<bool>,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub id: String,
    pub agent: String,
    pub content: String,
    pub tokens: u32,
}

#[derive(Serialize)]
pub struct AgentInfo {
    pub name: String,
    pub description: String,
}

/// Health check endpoint
pub async fn health() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: crate::VERSION.to_string(),
    })
}

/// Status endpoint
pub async fn status() -> impl IntoResponse {
    let sys = sysinfo::System::new_all();

    Json(StatusResponse {
        status: "ok".to_string(),
        version: crate::VERSION.to_string(),
        uptime_seconds: sysinfo::System::uptime(),
        memory_mb: sys.used_memory() / 1024 / 1024,
    })
}

/// Chat endpoint
pub async fn chat(Json(req): Json<ChatRequest>) -> impl IntoResponse {
    // TODO: Implement actual chat logic
    let response = ChatResponse {
        id: uuid::Uuid::new_v4().to_string(),
        agent: req.agent.unwrap_or_else(|| "shell".to_string()),
        content: format!("Echo: {}", req.message),
        tokens: 0,
    };

    Json(response)
}

/// Get chat history
pub async fn get_history() -> impl IntoResponse {
    // TODO: Implement history retrieval
    Json(serde_json::json!({
        "messages": []
    }))
}

/// Clear chat history
pub async fn clear_history() -> impl IntoResponse {
    // TODO: Implement history clearing
    Json(serde_json::json!({
        "status": "ok"
    }))
}

/// List available agents
pub async fn list_agents() -> impl IntoResponse {
    let agents = vec![
        AgentInfo {
            name: "router".to_string(),
            description: "Intent classification and dispatch".to_string(),
        },
        AgentInfo {
            name: "coder".to_string(),
            description: "Code generation, editing, debugging".to_string(),
        },
        AgentInfo {
            name: "shell".to_string(),
            description: "Shell commands, system operations".to_string(),
        },
        AgentInfo {
            name: "filer".to_string(),
            description: "File operations, search, organization".to_string(),
        },
        AgentInfo {
            name: "memory".to_string(),
            description: "Context management, summarization".to_string(),
        },
        AgentInfo {
            name: "app".to_string(),
            description: "Web app creation for launcher".to_string(),
        },
    ];

    Json(agents)
}

/// List available models
pub async fn list_models() -> impl IntoResponse {
    let paths = match crate::config::Paths::new(None) {
        Ok(p) => p,
        Err(_) => {
            return Json(serde_json::json!({
                "models": [],
                "error": "Failed to get paths"
            }));
        }
    };

    let models: Vec<String> = paths
        .list_models()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .collect();

    Json(serde_json::json!({
        "models": models
    }))
}
