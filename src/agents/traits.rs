//! Agent trait definitions

use crate::error::CnapseError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Role of a message in conversation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Tool,
}

/// A message in the conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub role: MessageRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

impl AgentMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::System,
            content: content.into(),
            metadata: None,
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::User,
            content: content.into(),
            metadata: None,
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::Assistant,
            content: content.into(),
            metadata: None,
        }
    }

    pub fn tool(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::Tool,
            content: content.into(),
            metadata: None,
        }
    }
}

/// A tool that an agent can use
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

/// A tool call made by an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Context provided to an agent for execution
#[derive(Debug, Clone, Default)]
pub struct AgentContext {
    /// Conversation messages
    pub messages: Vec<AgentMessage>,
    /// Available tools
    pub tools: Vec<Tool>,
    /// Retrieved memory context
    pub memory: Option<String>,
    /// Provider override
    pub provider_override: Option<String>,
    /// Current working directory
    pub cwd: Option<String>,
}

/// Response from an agent
#[derive(Debug, Clone)]
pub struct AgentResponse {
    /// Text content of the response
    pub content: String,
    /// Tool calls to execute
    pub tool_calls: Vec<ToolCall>,
    /// Tokens used for this response
    pub tokens_used: u32,
    /// Whether the agent loop should continue
    pub should_continue: bool,
}

impl AgentResponse {
    pub fn text(content: impl Into<String>) -> Self {
        Self {
            content: content.into(),
            tool_calls: Vec::new(),
            tokens_used: 0,
            should_continue: false,
        }
    }

    pub fn with_tool_calls(mut self, calls: Vec<ToolCall>) -> Self {
        self.should_continue = !calls.is_empty();
        self.tool_calls = calls;
        self
    }
}

/// The main Agent trait
#[async_trait]
pub trait Agent: Send + Sync {
    /// Get the agent's name
    fn name(&self) -> &'static str;

    /// Get a description of what this agent does
    fn description(&self) -> &'static str;

    /// Get the system prompt for this agent
    fn system_prompt(&self) -> String;

    /// Execute the agent with the given context
    async fn execute(&self, ctx: AgentContext) -> Result<AgentResponse, CnapseError>;

    /// Score how well this agent can handle a given intent (0.0 to 1.0)
    fn can_handle(&self, intent: &str) -> f32 {
        // Default implementation - override in specific agents
        let _ = intent;
        0.0
    }

    /// Get the tools available to this agent
    fn tools(&self) -> Vec<Tool> {
        Vec::new()
    }
}
