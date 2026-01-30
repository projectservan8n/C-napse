//! App management API

use axum::{
    extract::{Json, Path},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use crate::config::Paths;

#[derive(Serialize)]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    pub framework: String,
    pub url: String,
}

#[derive(Deserialize)]
pub struct CreateAppRequest {
    pub name: String,
    pub framework: Option<String>,
}

#[derive(Serialize)]
pub struct CreateAppResponse {
    pub id: String,
    pub name: String,
    pub framework: String,
    pub url: String,
}

/// List all apps
pub async fn list_apps() -> impl IntoResponse {
    let paths = match Paths::new(None) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            );
        }
    };

    let app_dirs = match paths.list_apps() {
        Ok(apps) => apps,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            );
        }
    };

    let mut apps = Vec::new();

    for app_dir in app_dirs {
        let manifest_path = app_dir.join("manifest.json");
        if let Ok(content) = std::fs::read_to_string(&manifest_path) {
            if let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                let id = manifest["id"].as_str().unwrap_or_default().to_string();
                apps.push(AppInfo {
                    id: id.clone(),
                    name: manifest["name"].as_str().unwrap_or_default().to_string(),
                    framework: manifest["framework"].as_str().unwrap_or("vanilla").to_string(),
                    url: format!("/apps/{}/", id),
                });
            }
        }
    }

    (StatusCode::OK, Json(serde_json::json!({ "apps": apps })))
}

/// Get a specific app
pub async fn get_app(Path(id): Path<String>) -> impl IntoResponse {
    let paths = match Paths::new(None) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            );
        }
    };

    let app_dir = paths.app_path(&id);
    let manifest_path = app_dir.join("manifest.json");

    if !manifest_path.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "App not found" })),
        );
    }

    match std::fs::read_to_string(&manifest_path) {
        Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
            Ok(manifest) => (StatusCode::OK, Json(manifest)),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            ),
        },
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ),
    }
}

/// Create a new app
pub async fn create_app(Json(req): Json<CreateAppRequest>) -> impl IntoResponse {
    // Use the CLI app command logic
    let framework = req.framework.as_deref().unwrap_or("vue");

    // Generate ID from name
    let id: String = req
        .name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let paths = match Paths::new(None) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            );
        }
    };

    let app_dir = paths.app_path(&id);

    if app_dir.exists() {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({ "error": "App already exists" })),
        );
    }

    // Create app directory
    if let Err(e) = std::fs::create_dir_all(&app_dir) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        );
    }

    // Create manifest
    let now = chrono::Utc::now().to_rfc3339();
    let manifest = serde_json::json!({
        "id": id,
        "name": req.name,
        "framework": framework,
        "version": "1.0.0",
        "created_at": now,
        "updated_at": now,
    });

    if let Err(e) = std::fs::write(
        app_dir.join("manifest.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    ) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        );
    }

    (
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": id,
            "name": req.name,
            "framework": framework,
            "url": format!("/apps/{}/", id),
        })),
    )
}

/// Delete an app
pub async fn delete_app(Path(id): Path<String>) -> impl IntoResponse {
    let paths = match Paths::new(None) {
        Ok(p) => p,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            );
        }
    };

    let app_dir = paths.app_path(&id);

    if !app_dir.exists() {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "App not found" })),
        );
    }

    if let Err(e) = std::fs::remove_dir_all(&app_dir) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        );
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({ "status": "deleted" })),
    )
}
