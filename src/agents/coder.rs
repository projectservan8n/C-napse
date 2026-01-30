//! Coder Agent - Code generation, editing, debugging

use crate::agents::traits::{Agent, AgentContext, AgentResponse, Tool};
use crate::error::CnapseError;
use async_trait::async_trait;

pub struct CoderAgent;

impl CoderAgent {
    pub fn new() -> Self {
        Self
    }
}

impl Default for CoderAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for CoderAgent {
    fn name(&self) -> &'static str {
        "coder"
    }

    fn description(&self) -> &'static str {
        "Code generation, editing, debugging, and explanation"
    }

    fn system_prompt(&self) -> String {
        r#"You are the Coder agent for C-napse. You write, edit, debug, and explain code.

Guidelines:
- Write clean, idiomatic code with comments
- Prefer standard libraries over external dependencies
- Handle errors gracefully
- Include type hints for Python, TypeScript types where applicable
- When editing existing code, show only the changed portions with context

Available tools:
- read_file(path): Read file contents
- write_file(path, content): Write/create file
- edit_file(path, search, replace): Find and replace in file
- run_code(language, code): Execute code snippet

Always explain your changes briefly."#
            .to_string()
    }

    async fn execute(&self, ctx: AgentContext) -> Result<AgentResponse, CnapseError> {
        // For now, return a placeholder
        // Full implementation would use the inference backend
        let query = ctx
            .messages
            .iter()
            .rev()
            .find(|m| m.role == crate::agents::MessageRole::User)
            .map(|m| m.content.as_str())
            .unwrap_or("");

        Ok(AgentResponse::text(format!(
            "[Coder Agent]\n\nQuery: {}\n\n(Full LLM inference not yet implemented)",
            query
        )))
    }

    fn can_handle(&self, intent: &str) -> f32 {
        let lower = intent.to_lowercase();
        if lower.contains("code")
            || lower.contains("write")
            || lower.contains("function")
            || lower.contains("debug")
        {
            0.9
        } else {
            0.1
        }
    }

    fn tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "read_file".to_string(),
                description: "Read file contents".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to read"}
                    },
                    "required": ["path"]
                }),
            },
            Tool {
                name: "write_file".to_string(),
                description: "Write/create file".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to write"},
                        "content": {"type": "string", "description": "Content to write"}
                    },
                    "required": ["path", "content"]
                }),
            },
            Tool {
                name: "edit_file".to_string(),
                description: "Find and replace in file".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path to edit"},
                        "search": {"type": "string", "description": "Text to find"},
                        "replace": {"type": "string", "description": "Replacement text"}
                    },
                    "required": ["path", "search", "replace"]
                }),
            },
            Tool {
                name: "run_code".to_string(),
                description: "Execute code snippet".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "language": {"type": "string", "description": "Programming language"},
                        "code": {"type": "string", "description": "Code to execute"}
                    },
                    "required": ["language", "code"]
                }),
            },
        ]
    }
}
