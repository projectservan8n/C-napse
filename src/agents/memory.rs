//! Memory Agent - Context management, summarization, recall

use async_trait::async_trait;
use crate::agents::traits::{Agent, AgentContext, AgentResponse, Tool};
use crate::error::CnapseError;

pub struct MemoryAgent;

impl MemoryAgent {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MemoryAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for MemoryAgent {
    fn name(&self) -> &'static str {
        "memory"
    }

    fn description(&self) -> &'static str {
        "Context management, summarization, and recall of past interactions"
    }

    fn system_prompt(&self) -> String {
        r#"You are the Memory agent for C-napse. You manage conversation context and help recall past interactions.

Responsibilities:
1. Summarize long conversations to compress context
2. Retrieve relevant past interactions
3. Answer questions about conversation history
4. Maintain continuity across sessions

Available tools:
- search_memory(query): Semantic search past conversations
- get_summary(session_id): Get session summary
- save_note(content, tags): Save important information
- get_notes(tags?): Retrieve saved notes
- clear_session(): Clear current session memory

When summarizing:
- Preserve key decisions and outcomes
- Note any files created or modified
- Keep track of user preferences discovered"#.to_string()
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
            "[Memory Agent]\n\nQuery: {}\n\n(Full LLM inference not yet implemented)",
            query
        )))
    }

    fn can_handle(&self, intent: &str) -> f32 {
        let lower = intent.to_lowercase();
        if lower.contains("remember")
            || lower.contains("recall")
            || lower.contains("history")
            || lower.contains("yesterday")
            || lower.contains("earlier")
        {
            0.9
        } else {
            0.1
        }
    }

    fn tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "search_memory".to_string(),
                description: "Semantic search past conversations".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"}
                    },
                    "required": ["query"]
                }),
            },
            Tool {
                name: "save_note".to_string(),
                description: "Save important information".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Note content"},
                        "tags": {"type": "array", "items": {"type": "string"}, "description": "Tags for the note"}
                    },
                    "required": ["content"]
                }),
            },
            Tool {
                name: "get_notes".to_string(),
                description: "Retrieve saved notes".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "tags": {"type": "array", "items": {"type": "string"}, "description": "Filter by tags"}
                    }
                }),
            },
        ]
    }
}
