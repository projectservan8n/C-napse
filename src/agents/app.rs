//! App Agent - Web app creation for the launcher

use crate::agents::traits::{Agent, AgentContext, AgentResponse, Tool};
use crate::error::CnapseError;
use async_trait::async_trait;

pub struct AppAgent;

impl AppAgent {
    pub fn new() -> Self {
        Self
    }
}

impl Default for AppAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for AppAgent {
    fn name(&self) -> &'static str {
        "app"
    }

    fn description(&self) -> &'static str {
        "Create web applications for the C-napse app launcher"
    }

    fn system_prompt(&self) -> String {
        r#"You are the App agent for C-napse. You create web applications for the app launcher.

You create single-page applications that users can access from any device on their network.

Available frameworks:
- Vue 3 (default, with Composition API)
- React (with hooks)
- Svelte
- Vanilla JS/HTML/CSS

Guidelines:
- Create self-contained apps (single HTML or minimal files)
- Use CDN imports for frameworks (unpkg, esm.sh)
- Design mobile-first, responsive layouts
- Include dark mode support
- Use localStorage for persistence
- Apps should work offline after initial load

Available tools:
- create_app(name, framework): Initialize app structure
- write_app_file(app_id, path, content): Write file to app
- preview_app(app_id): Get preview URL
- deploy_app(app_id): Make app live on launcher

Example app structure:
{app_id}/
├── manifest.json
├── index.html
├── app.js (or app.vue, app.tsx)
├── style.css
└── assets/"#
            .to_string()
    }

    async fn execute(&self, ctx: AgentContext) -> Result<AgentResponse, CnapseError> {
        let query = ctx
            .messages
            .iter()
            .rev()
            .find(|m| m.role == crate::agents::MessageRole::User)
            .map(|m| m.content.as_str())
            .unwrap_or("");

        Ok(AgentResponse::text(format!(
            "[App Agent]\n\nQuery: {}\n\n(Full LLM inference not yet implemented)",
            query
        )))
    }

    fn can_handle(&self, intent: &str) -> f32 {
        let lower = intent.to_lowercase();
        if lower.contains("app")
            || lower.contains("webapp")
            || lower.contains("website")
            || lower.contains("dashboard")
            || lower.contains("interface")
        {
            0.9
        } else {
            0.1
        }
    }

    fn tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "create_app".to_string(),
                description: "Initialize app structure".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "App name"},
                        "framework": {"type": "string", "description": "Framework to use"}
                    },
                    "required": ["name"]
                }),
            },
            Tool {
                name: "write_app_file".to_string(),
                description: "Write file to app".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "app_id": {"type": "string", "description": "App ID"},
                        "path": {"type": "string", "description": "File path within app"},
                        "content": {"type": "string", "description": "File content"}
                    },
                    "required": ["app_id", "path", "content"]
                }),
            },
            Tool {
                name: "preview_app".to_string(),
                description: "Get preview URL".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "app_id": {"type": "string", "description": "App ID"}
                    },
                    "required": ["app_id"]
                }),
            },
            Tool {
                name: "deploy_app".to_string(),
                description: "Make app live on launcher".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "app_id": {"type": "string", "description": "App ID"}
                    },
                    "required": ["app_id"]
                }),
            },
        ]
    }
}
