//! Context management with hot/warm/cold hierarchy

use super::store::{MemoryStore, StoredMessage};
use crate::agents::AgentMessage;
use crate::config::Settings;
use crate::error::Result;

/// Manages conversation context with hierarchical storage
pub struct ContextManager {
    store: MemoryStore,
    settings: Settings,
    session_id: String,
    hot_messages: Vec<AgentMessage>,
}

impl ContextManager {
    /// Create a new context manager
    pub fn new(settings: Settings) -> Result<Self> {
        let store = MemoryStore::open()?;
        let session_id = store.get_or_create_session()?;

        Ok(Self {
            store,
            settings,
            session_id,
            hot_messages: Vec::new(),
        })
    }

    /// Add a message to context
    pub fn add_message(&mut self, message: AgentMessage, agent: Option<&str>) -> Result<()> {
        // Add to hot context
        self.hot_messages.push(message.clone());

        // Persist to cold storage
        let role = match message.role {
            crate::agents::MessageRole::System => "system",
            crate::agents::MessageRole::User => "user",
            crate::agents::MessageRole::Assistant => "assistant",
            crate::agents::MessageRole::Tool => "tool",
        };

        self.store
            .add_message(&self.session_id, role, &message.content, agent, None)?;

        // Trim hot context if needed
        let max_hot = self.settings.memory.hot_turns * 2; // User + Assistant per turn
        if self.hot_messages.len() > max_hot {
            // Move oldest to warm (would trigger summarization in full impl)
            self.hot_messages
                .drain(0..self.hot_messages.len() - max_hot);
        }

        Ok(())
    }

    /// Get messages for context window
    pub fn get_context(&self) -> Vec<AgentMessage> {
        self.hot_messages.clone()
    }

    /// Get context with warm retrieval based on query
    pub fn get_context_with_retrieval(&self, query: &str) -> Result<Vec<AgentMessage>> {
        let mut context = self.hot_messages.clone();

        // Search for relevant past messages
        if self.settings.memory.warm_chunks > 0 {
            let relevant = self
                .store
                .search_messages(query, self.settings.memory.warm_chunks)?;

            // Add relevant context as a system message
            if !relevant.is_empty() {
                let context_str = relevant
                    .iter()
                    .map(|m| format!("[{}]: {}", m.role, m.content))
                    .collect::<Vec<_>>()
                    .join("\n");

                context.insert(
                    0,
                    AgentMessage::system(format!(
                        "Relevant context from previous conversations:\n{}",
                        context_str
                    )),
                );
            }
        }

        Ok(context)
    }

    /// Start a new session
    pub fn new_session(&mut self) -> Result<()> {
        self.session_id = self.store.create_session()?;
        self.hot_messages.clear();
        Ok(())
    }

    /// Get current session ID
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Clear current session
    pub fn clear(&mut self) -> Result<()> {
        self.store.clear_session(&self.session_id)?;
        self.hot_messages.clear();
        self.session_id = self.store.create_session()?;
        Ok(())
    }

    /// Save a note
    pub fn save_note(&self, content: &str, tags: &[String]) -> Result<String> {
        self.store.save_note(content, tags)
    }

    /// Get notes
    pub fn get_notes(&self, tags: Option<&[String]>) -> Result<Vec<super::store::StoredNote>> {
        self.store.get_notes(tags, 100)
    }

    /// Search past conversations
    pub fn search(&self, query: &str) -> Result<Vec<StoredMessage>> {
        self.store.search_messages(query, 50)
    }
}
