//! WebSocket handler for real-time communication

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query,
    },
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "auth")]
    Auth { key: String },

    #[serde(rename = "chat")]
    Chat {
        id: String,
        content: String,
        provider: Option<String>,
        agent: Option<String>,
        stream: Option<bool>,
    },

    #[serde(rename = "cancel")]
    Cancel { id: String },
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "chunk")]
    Chunk {
        id: String,
        content: String,
        done: bool,
    },

    #[serde(rename = "response")]
    Response {
        id: String,
        content: String,
        agent: String,
        tokens: u32,
        done: bool,
    },

    #[serde(rename = "tool")]
    Tool {
        id: String,
        tool: String,
        args: serde_json::Value,
        status: String,
        result: Option<String>,
    },

    #[serde(rename = "error")]
    Error {
        id: Option<String>,
        error: String,
        code: String,
    },
}

/// WebSocket upgrade handler
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, query.token))
}

async fn handle_socket(socket: WebSocket, token: Option<String>) {
    let (mut sender, mut receiver) = socket.split();

    // Handle authentication if needed
    let mut authenticated = token.is_some();

    while let Some(msg) = receiver.next().await {
        let msg = match msg {
            Ok(Message::Text(text)) => text,
            Ok(Message::Close(_)) => break,
            Ok(_) => continue,
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
        };

        // Parse message
        let client_msg: ClientMessage = match serde_json::from_str(&msg) {
            Ok(m) => m,
            Err(e) => {
                let error = ServerMessage::Error {
                    id: None,
                    error: format!("Invalid message: {}", e),
                    code: "PARSE_ERROR".to_string(),
                };
                let _ = sender
                    .send(Message::Text(serde_json::to_string(&error).unwrap().into()))
                    .await;
                continue;
            }
        };

        // Handle message
        match client_msg {
            ClientMessage::Auth { key } => {
                // TODO: Validate key against credentials
                authenticated = true;
                let response = ServerMessage::Response {
                    id: "auth".to_string(),
                    content: "Authenticated".to_string(),
                    agent: "system".to_string(),
                    tokens: 0,
                    done: true,
                };
                let _ = sender
                    .send(Message::Text(serde_json::to_string(&response).unwrap().into()))
                    .await;
            }

            ClientMessage::Chat {
                id,
                content,
                provider,
                agent,
                stream,
            } => {
                if !authenticated {
                    let error = ServerMessage::Error {
                        id: Some(id),
                        error: "Not authenticated".to_string(),
                        code: "AUTH_REQUIRED".to_string(),
                    };
                    let _ = sender
                        .send(Message::Text(serde_json::to_string(&error).unwrap().into()))
                        .await;
                    continue;
                }

                // TODO: Implement actual chat processing
                let response = ServerMessage::Response {
                    id,
                    content: format!("Echo: {}", content),
                    agent: agent.unwrap_or_else(|| "shell".to_string()),
                    tokens: 0,
                    done: true,
                };
                let _ = sender
                    .send(Message::Text(serde_json::to_string(&response).unwrap().into()))
                    .await;
            }

            ClientMessage::Cancel { id } => {
                // TODO: Implement cancellation
                let response = ServerMessage::Response {
                    id,
                    content: "Cancelled".to_string(),
                    agent: "system".to_string(),
                    tokens: 0,
                    done: true,
                };
                let _ = sender
                    .send(Message::Text(serde_json::to_string(&response).unwrap().into()))
                    .await;
            }
        }
    }
}
