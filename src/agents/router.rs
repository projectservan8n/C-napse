//! Router Agent - Classifies user intent and dispatches to specialist agents

use async_trait::async_trait;
use crate::agents::traits::{Agent, AgentContext, AgentResponse};
use crate::error::CnapseError;

pub struct RouterAgent;

impl RouterAgent {
    pub fn new() -> Self {
        Self
    }
}

impl Default for RouterAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for RouterAgent {
    fn name(&self) -> &'static str {
        "router"
    }

    fn description(&self) -> &'static str {
        "Classifies user intent and dispatches to the appropriate specialist agent"
    }

    fn system_prompt(&self) -> String {
        r#"You are a routing agent for C-napse. Your job is to analyze user requests and determine which specialist agent should handle them.

Available agents:
- CODER: Code generation, editing, debugging, refactoring
- FILER: File operations (read, write, search, organize)
- SHELL: Shell commands, system operations, process management
- MEMORY: Context recall, summarization, search history
- APP: Create web apps for the launcher

Respond with ONLY the agent name, nothing else.

Examples:
User: "Write a Python script to sort files by date"
CODER

User: "Find all PDFs in my Documents folder"
FILER

User: "What's using port 8080?"
SHELL

User: "What did we talk about yesterday?"
MEMORY

User: "Create a todo app I can access from my phone"
APP"#.to_string()
    }

    async fn execute(&self, ctx: AgentContext) -> Result<AgentResponse, CnapseError> {
        // Get the last user message
        let query = ctx
            .messages
            .iter()
            .rev()
            .find(|m| m.role == crate::agents::MessageRole::User)
            .map(|m| m.content.as_str())
            .unwrap_or("");

        // Simple keyword-based routing for now
        // In full implementation, this would use the LLM
        let agent = self.route_by_keywords(query);

        Ok(AgentResponse::text(agent))
    }

    fn can_handle(&self, _intent: &str) -> f32 {
        // Router can handle anything - it's the dispatcher
        1.0
    }
}

impl RouterAgent {
    fn route_by_keywords(&self, query: &str) -> &'static str {
        let query_lower = query.to_lowercase();

        // Code-related keywords
        if query_lower.contains("code")
            || query_lower.contains("write")
            || query_lower.contains("function")
            || query_lower.contains("script")
            || query_lower.contains("debug")
            || query_lower.contains("fix")
            || query_lower.contains("implement")
            || query_lower.contains("refactor")
            || query_lower.contains("class")
            || query_lower.contains("method")
        {
            return "CODER";
        }

        // File-related keywords
        if query_lower.contains("file")
            || query_lower.contains("folder")
            || query_lower.contains("directory")
            || query_lower.contains("find")
            || query_lower.contains("search")
            || query_lower.contains("list")
            || query_lower.contains("copy")
            || query_lower.contains("move")
            || query_lower.contains("delete")
            || query_lower.contains("rename")
        {
            return "FILER";
        }

        // Shell-related keywords
        if query_lower.contains("run")
            || query_lower.contains("execute")
            || query_lower.contains("command")
            || query_lower.contains("install")
            || query_lower.contains("process")
            || query_lower.contains("port")
            || query_lower.contains("service")
            || query_lower.contains("start")
            || query_lower.contains("stop")
            || query_lower.contains("restart")
        {
            return "SHELL";
        }

        // Memory-related keywords
        if query_lower.contains("remember")
            || query_lower.contains("recall")
            || query_lower.contains("history")
            || query_lower.contains("yesterday")
            || query_lower.contains("earlier")
            || query_lower.contains("before")
            || query_lower.contains("last time")
            || query_lower.contains("previous")
        {
            return "MEMORY";
        }

        // App-related keywords
        if query_lower.contains("app")
            || query_lower.contains("webapp")
            || query_lower.contains("website")
            || query_lower.contains("launcher")
            || query_lower.contains("dashboard")
            || query_lower.contains("ui")
            || query_lower.contains("interface")
        {
            return "APP";
        }

        // Default to shell for general queries
        "SHELL"
    }
}
