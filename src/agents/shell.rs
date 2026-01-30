//! Shell Agent - Shell commands and system operations

use async_trait::async_trait;
use crate::agents::traits::{Agent, AgentContext, AgentResponse, Tool};
use crate::error::CnapseError;

pub struct ShellAgent;

impl ShellAgent {
    pub fn new() -> Self {
        Self
    }
}

impl Default for ShellAgent {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for ShellAgent {
    fn name(&self) -> &'static str {
        "shell"
    }

    fn description(&self) -> &'static str {
        "Shell commands, system operations, process management"
    }

    fn system_prompt(&self) -> String {
        let os = std::env::consts::OS;
        let shell = if cfg!(windows) { "PowerShell" } else { "bash" };

        format!(r#"You are the Shell agent for C-napse. You generate and execute shell commands.

Current OS: {}
Shell: {}

Guidelines:
- Generate safe, non-destructive commands by default
- Always confirm before destructive operations (rm -rf, format, etc.)
- Explain what each command does
- Use portable commands when possible
- For complex tasks, break into steps

Available tools:
- run_command(cmd): Execute shell command
- get_env(var): Get environment variable
- set_env(var, value): Set environment variable
- list_processes(): List running processes
- kill_process(pid): Terminate process

NEVER run commands that could:
- Delete system files
- Modify boot configuration
- Change user permissions without confirmation
- Execute downloaded scripts without review"#, os, shell)
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
            "[Shell Agent]\n\nQuery: {}\n\n(Full LLM inference not yet implemented)",
            query
        )))
    }

    fn can_handle(&self, intent: &str) -> f32 {
        let lower = intent.to_lowercase();
        if lower.contains("run")
            || lower.contains("execute")
            || lower.contains("command")
            || lower.contains("process")
            || lower.contains("port")
        {
            0.9
        } else {
            0.2
        }
    }

    fn tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "run_command".to_string(),
                description: "Execute shell command".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "cmd": {"type": "string", "description": "Command to execute"}
                    },
                    "required": ["cmd"]
                }),
            },
            Tool {
                name: "get_env".to_string(),
                description: "Get environment variable".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "var": {"type": "string", "description": "Variable name"}
                    },
                    "required": ["var"]
                }),
            },
            Tool {
                name: "list_processes".to_string(),
                description: "List running processes".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {}
                }),
            },
            Tool {
                name: "kill_process".to_string(),
                description: "Terminate process".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "pid": {"type": "integer", "description": "Process ID"}
                    },
                    "required": ["pid"]
                }),
            },
        ]
    }
}
