//! Web server and API for C-napse

pub mod api;
pub mod websocket;
pub mod auth;
pub mod apps;

use crate::config::Settings;
use crate::error::{CnapseError, Result};
use axum::{
    routing::{get, post, delete},
    Router,
};
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;
use std::net::SocketAddr;

/// Start the C-napse server
pub async fn start_server(
    host: String,
    port: u16,
    no_web: bool,
    no_auth: bool,
    settings: Settings,
) -> Result<()> {
    let app = create_router(no_web, no_auth, settings)?;

    let addr: SocketAddr = format!("{}:{}", host, port)
        .parse()
        .map_err(|e| CnapseError::config(format!("Invalid address: {}", e)))?;

    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| CnapseError::network(format!("Failed to bind: {}", e)))?;

    axum::serve(listener, app)
        .await
        .map_err(|e| CnapseError::network(format!("Server error: {}", e)))?;

    Ok(())
}

fn create_router(no_web: bool, no_auth: bool, settings: Settings) -> Result<Router> {
    // API routes
    let api_routes = Router::new()
        .route("/health", get(api::health))
        .route("/status", get(api::status))
        .route("/chat", post(api::chat))
        .route("/chat/history", get(api::get_history))
        .route("/chat/history", delete(api::clear_history))
        .route("/agents", get(api::list_agents))
        .route("/apps", get(apps::list_apps))
        .route("/apps", post(apps::create_app))
        .route("/apps/:id", get(apps::get_app))
        .route("/apps/:id", delete(apps::delete_app))
        .route("/models", get(api::list_models));

    let mut app = Router::new()
        .nest("/api/v1", api_routes)
        .route("/ws", get(websocket::ws_handler));

    // Add web interface if not disabled
    if !no_web {
        app = app
            .route("/", get(web_index))
            .route("/apps", get(apps_index));
    }

    // Add CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Add tracing layer
    let app = app
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    Ok(app)
}

async fn web_index() -> axum::response::Html<&'static str> {
    axum::response::Html(include_str!("templates/index.html"))
}

async fn apps_index() -> axum::response::Html<&'static str> {
    axum::response::Html(include_str!("templates/apps.html"))
}
