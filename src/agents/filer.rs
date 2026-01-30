//! Filer Agent - File system operations

use crate::agents::traits::{Agent, AgentContext, AgentResponse, Tool};
use crate::error::CnapseError;
use async_trait::async_trait;

pub struct FilerAgent;

impl FilerAgent {
    pub fn new() -> Self {
        Self
    }
}

impl Default for FilerAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for FilerAgent {
    fn name(&self) -> &'static str {
        "filer"
    }

    fn description(&self) -> &'static str {
        "File system operations - read, write, search, organize"
    }

    fn system_prompt(&self) -> String {
        r#"You are the Filer agent for C-napse. You handle all file system operations.

Guidelines:
- Always use absolute paths internally
- Confirm before overwriting existing files
- Preserve file permissions and timestamps when copying
- For search, use efficient methods (ripgrep patterns)

Available tools:
- list_dir(path, recursive?): List directory contents
- read_file(path): Read file contents
- write_file(path, content): Write file
- copy(src, dst): Copy file or directory
- move(src, dst): Move/rename
- delete(path, force?): Delete (requires confirmation unless force)
- search(pattern, path, type?): Search files by name/content
- file_info(path): Get file metadata
- watch(path): Watch for changes"#
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
            "[Filer Agent]\n\nQuery: {}\n\n(Full LLM inference not yet implemented)",
            query
        )))
    }

    fn can_handle(&self, intent: &str) -> f32 {
        let lower = intent.to_lowercase();
        if lower.contains("file")
            || lower.contains("folder")
            || lower.contains("directory")
            || lower.contains("search")
        {
            0.9
        } else {
            0.1
        }
    }

    fn tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "list_dir".to_string(),
                description: "List directory contents".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Directory path"},
                        "recursive": {"type": "boolean", "description": "List recursively"}
                    },
                    "required": ["path"]
                }),
            },
            Tool {
                name: "search".to_string(),
                description: "Search files by name or content".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Search pattern"},
                        "path": {"type": "string", "description": "Base path"},
                        "type": {"type": "string", "description": "Search type: name or content"}
                    },
                    "required": ["pattern"]
                }),
            },
            Tool {
                name: "file_info".to_string(),
                description: "Get file metadata".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "File path"}
                    },
                    "required": ["path"]
                }),
            },
        ]
    }
}
