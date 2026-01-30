//! TUI Application state and logic

use crate::agents::{AgentMessage, MessageRole};
use crate::config::Settings;
use crate::error::Result;
use crate::inference::{create_backend, InferenceRequest};
use crate::memory::MemoryStore;
use crate::tui::screen_watcher::ScreenWatcher;
use chrono::{DateTime, Local};
use crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
use ratatui::{prelude::*, Terminal};
use std::time::Duration;
use uuid::Uuid;

/// Message in the chat
#[derive(Clone)]
pub struct ChatMessage {
    pub id: String,
    pub role: MessageRole,
    pub content: String,
    pub timestamp: DateTime<Local>,
    pub tool_calls: Vec<ToolCall>,
    pub is_streaming: bool,
}

/// Tool call visualization
#[derive(Clone)]
pub struct ToolCall {
    pub name: String,
    pub status: ToolStatus,
    pub result: Option<String>,
}

#[derive(Clone, PartialEq)]
pub enum ToolStatus {
    Running,
    Success,
    Failed,
}

/// TUI Application
pub struct TuiApp {
    /// Current input text
    pub input: String,
    /// Cursor position in input
    pub cursor_pos: usize,
    /// Chat messages
    pub messages: Vec<ChatMessage>,
    /// Scroll position
    pub scroll: usize,
    /// Is app running
    pub running: bool,
    /// Settings
    pub settings: Settings,
    /// Memory store
    pub memory: MemoryStore,
    /// Current conversation ID
    pub conversation_id: String,
    /// Screen watcher
    pub screen_watcher: Option<ScreenWatcher>,
    /// Is screen watching enabled
    pub screen_watching: bool,
    /// Status message
    pub status: String,
    /// Is currently processing
    pub processing: bool,
    /// Input history
    pub history: Vec<String>,
    /// History index
    pub history_index: Option<usize>,
}

impl TuiApp {
    pub async fn new() -> Result<Self> {
        let settings = Settings::load()?;
        let memory = MemoryStore::open()?;
        let conversation_id = Uuid::new_v4().to_string();

        Ok(Self {
            input: String::new(),
            cursor_pos: 0,
            messages: vec![ChatMessage {
                id: Uuid::new_v4().to_string(),
                role: MessageRole::System,
                content: "Welcome to C-napse! Type your message and press Enter to send.\n\nShortcuts:\n  Ctrl+C - Exit\n  Ctrl+L - Clear screen\n  Ctrl+W - Toggle screen watching\n  Up/Down - Navigate history".to_string(),
                timestamp: Local::now(),
                tool_calls: vec![],
                is_streaming: false,
            }],
            scroll: 0,
            running: true,
            settings,
            memory,
            conversation_id,
            screen_watcher: None,
            screen_watching: false,
            status: "Ready".to_string(),
            processing: false,
            history: Vec::new(),
            history_index: None,
        })
    }

    pub async fn run<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()> {
        while self.running {
            // Draw UI
            terminal.draw(|f| self.draw(f))?;

            // Handle events with timeout
            if event::poll(Duration::from_millis(100))? {
                if let Event::Key(key) = event::read()? {
                    if key.kind == KeyEventKind::Press {
                        self.handle_key(key.code, key.modifiers).await?;
                    }
                }
            }

            // Check screen watcher
            if self.screen_watching {
                if let Some(watcher) = &mut self.screen_watcher {
                    if let Some(change) = watcher.check_for_changes() {
                        self.add_system_message(format!("🖥️ Screen change detected: {}", change));
                    }
                }
            }
        }

        Ok(())
    }

    fn draw(&self, frame: &mut Frame) {
        use super::ui;
        ui::draw(frame, self);
    }

    async fn handle_key(&mut self, key: KeyCode, modifiers: KeyModifiers) -> Result<()> {
        match (key, modifiers) {
            // Exit
            (KeyCode::Char('c'), KeyModifiers::CONTROL) => {
                self.running = false;
            }
            // Clear screen
            (KeyCode::Char('l'), KeyModifiers::CONTROL) => {
                self.messages.clear();
                self.add_system_message("Screen cleared".to_string());
            }
            // Toggle screen watching
            (KeyCode::Char('w'), KeyModifiers::CONTROL) => {
                self.toggle_screen_watching().await;
            }
            // Submit message
            (KeyCode::Enter, _) => {
                if !self.input.is_empty() && !self.processing {
                    self.submit_message().await?;
                }
            }
            // Backspace
            (KeyCode::Backspace, _) => {
                if self.cursor_pos > 0 {
                    self.input.remove(self.cursor_pos - 1);
                    self.cursor_pos -= 1;
                }
            }
            // Delete
            (KeyCode::Delete, _) => {
                if self.cursor_pos < self.input.len() {
                    self.input.remove(self.cursor_pos);
                }
            }
            // Move cursor left
            (KeyCode::Left, _) => {
                if self.cursor_pos > 0 {
                    self.cursor_pos -= 1;
                }
            }
            // Move cursor right
            (KeyCode::Right, _) => {
                if self.cursor_pos < self.input.len() {
                    self.cursor_pos += 1;
                }
            }
            // Home
            (KeyCode::Home, _) => {
                self.cursor_pos = 0;
            }
            // End
            (KeyCode::End, _) => {
                self.cursor_pos = self.input.len();
            }
            // History up
            (KeyCode::Up, _) => {
                if !self.history.is_empty() {
                    match self.history_index {
                        Some(idx) if idx > 0 => {
                            self.history_index = Some(idx - 1);
                            self.input = self.history[idx - 1].clone();
                            self.cursor_pos = self.input.len();
                        }
                        None => {
                            self.history_index = Some(self.history.len() - 1);
                            self.input = self.history.last().unwrap().clone();
                            self.cursor_pos = self.input.len();
                        }
                        _ => {}
                    }
                }
            }
            // History down
            (KeyCode::Down, _) => {
                if let Some(idx) = self.history_index {
                    if idx < self.history.len() - 1 {
                        self.history_index = Some(idx + 1);
                        self.input = self.history[idx + 1].clone();
                        self.cursor_pos = self.input.len();
                    } else {
                        self.history_index = None;
                        self.input.clear();
                        self.cursor_pos = 0;
                    }
                }
            }
            // Scroll up
            (KeyCode::PageUp, _) => {
                if self.scroll > 0 {
                    self.scroll = self.scroll.saturating_sub(5);
                }
            }
            // Scroll down
            (KeyCode::PageDown, _) => {
                self.scroll += 5;
            }
            // Type character
            (KeyCode::Char(c), KeyModifiers::NONE | KeyModifiers::SHIFT) => {
                self.input.insert(self.cursor_pos, c);
                self.cursor_pos += 1;
            }
            _ => {}
        }

        Ok(())
    }

    async fn submit_message(&mut self) -> Result<()> {
        let user_input = std::mem::take(&mut self.input);
        self.cursor_pos = 0;
        self.history.push(user_input.clone());
        self.history_index = None;

        // Add user message
        self.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: MessageRole::User,
            content: user_input.clone(),
            timestamp: Local::now(),
            tool_calls: vec![],
            is_streaming: false,
        });

        // Handle slash commands
        if user_input.starts_with('/') {
            return self.handle_command(&user_input).await;
        }

        self.processing = true;
        self.status = "Thinking...".to_string();

        // Add assistant message placeholder
        let assistant_msg_id = Uuid::new_v4().to_string();
        self.messages.push(ChatMessage {
            id: assistant_msg_id.clone(),
            role: MessageRole::Assistant,
            content: String::new(),
            timestamp: Local::now(),
            tool_calls: vec![],
            is_streaming: true,
        });

        // Process with agent
        match self.process_with_agent(&user_input).await {
            Ok(response) => {
                // Update assistant message
                if let Some(msg) = self.messages.iter_mut().find(|m| m.id == assistant_msg_id) {
                    msg.content = response;
                    msg.is_streaming = false;
                }
            }
            Err(e) => {
                // Update with error
                if let Some(msg) = self.messages.iter_mut().find(|m| m.id == assistant_msg_id) {
                    msg.content = format!("Error: {}", e);
                    msg.is_streaming = false;
                }
            }
        }

        self.processing = false;
        self.status = "Ready".to_string();

        // Auto-scroll to bottom
        self.scroll = self.messages.len().saturating_sub(1);

        Ok(())
    }

    async fn process_with_agent(&mut self, input: &str) -> Result<String> {
        use crate::tui::{parse_tool_calls, tools_description, ToolExecutor};

        // Build context from recent messages
        let messages: Vec<AgentMessage> = self
            .messages
            .iter()
            .filter(|m| matches!(m.role, MessageRole::User | MessageRole::Assistant))
            .take(10) // Last 10 messages for context
            .map(|m| AgentMessage {
                role: m.role.clone(),
                content: m.content.clone(),
                metadata: None,
            })
            .collect();

        // Add screen context if watching
        let mut context = input.to_string();
        if self.screen_watching {
            if let Some(watcher) = &self.screen_watcher {
                if let Some(desc) = watcher.get_current_description() {
                    context = format!("[Current screen: {}]\n\n{}", desc, input);
                }
            }
        }

        // Create inference request
        let backend = create_backend(&self.settings).await?;

        // Build system prompt with tools
        let system_prompt = format!(
            "You are C-napse, a helpful AI assistant for PC automation running on the user's desktop. \
            You can help with coding, file management, shell commands, and more. Be concise and helpful.\n\n\
            {}\n\n\
            When the user asks you to do something, use the appropriate tool. \
            Always explain what you're doing before using a tool.",
            tools_description()
        );

        let mut all_messages = vec![AgentMessage {
            role: MessageRole::System,
            content: system_prompt,
            metadata: None,
        }];
        all_messages.extend(messages);
        all_messages.push(AgentMessage {
            role: MessageRole::User,
            content: context,
            metadata: None,
        });

        let request = InferenceRequest {
            model: self.settings.get_default_model(),
            messages: all_messages.clone(),
            temperature: 0.7,
            max_tokens: 2048,
            stop: vec![],
            stream: false,
        };

        let response = backend.infer(request).await?;
        let mut final_response = response.content.clone();

        // Check for tool calls and execute them
        let tool_calls = parse_tool_calls(&response.content);
        if !tool_calls.is_empty() {
            let executor = ToolExecutor::new();

            // Update the current message to show tool calls
            if let Some(msg) = self.messages.last_mut() {
                for tool in &tool_calls {
                    msg.tool_calls.push(ToolCall {
                        name: tool.name.clone(),
                        status: ToolStatus::Running,
                        result: None,
                    });
                }
            }

            // Execute each tool
            let mut tool_results = Vec::new();
            for (i, tool) in tool_calls.iter().enumerate() {
                self.status = format!("Running {}...", tool.name);

                let result = executor.execute(tool).await;

                // Update tool status in message
                if let Some(msg) = self.messages.last_mut() {
                    if let Some(tc) = msg.tool_calls.get_mut(i) {
                        match &result {
                            Ok(r) if r.success => {
                                tc.status = ToolStatus::Success;
                                tc.result = Some(r.output.clone());
                            }
                            Ok(r) => {
                                tc.status = ToolStatus::Failed;
                                tc.result = r.error.clone();
                            }
                            Err(e) => {
                                tc.status = ToolStatus::Failed;
                                tc.result = Some(e.to_string());
                            }
                        }
                    }
                }

                if let Ok(r) = result {
                    tool_results.push(format!(
                        "[{} result: {}]",
                        tool.name,
                        if r.success {
                            &r.output
                        } else {
                            r.error.as_deref().unwrap_or("Failed")
                        }
                    ));
                }
            }

            // If tools were executed, get a follow-up response with results
            if !tool_results.is_empty() {
                all_messages.push(AgentMessage {
                    role: MessageRole::Assistant,
                    content: response.content.clone(),
                    metadata: None,
                });
                all_messages.push(AgentMessage {
                    role: MessageRole::User,
                    content: format!("Tool results:\n{}", tool_results.join("\n")),
                    metadata: None,
                });

                let follow_up_request = InferenceRequest {
                    model: self.settings.get_default_model(),
                    messages: all_messages,
                    temperature: 0.7,
                    max_tokens: 2048,
                    stop: vec![],
                    stream: false,
                };

                if let Ok(follow_up) = backend.infer(follow_up_request).await {
                    final_response = format!("{}\n\n{}", response.content, follow_up.content);
                }
            }
        }

        // Save to memory
        self.memory
            .add_message(&self.conversation_id, "user", input, None, None)?;
        self.memory.add_message(
            &self.conversation_id,
            "assistant",
            &final_response,
            None,
            None,
        )?;

        Ok(final_response)
    }

    async fn handle_command(&mut self, cmd: &str) -> Result<()> {
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        let command = parts.first().map(|s| *s).unwrap_or("");

        match command {
            "/help" => {
                self.add_system_message(
                    "Available commands:\n\
                     /help - Show this help\n\
                     /clear - Clear chat history\n\
                     /watch - Toggle screen watching\n\
                     /model <name> - Switch model\n\
                     /status - Show current status\n\
                     /new - Start new conversation\n\
                     /exit - Exit C-napse"
                        .to_string(),
                );
            }
            "/clear" => {
                self.messages.clear();
                self.add_system_message("Chat cleared".to_string());
            }
            "/watch" => {
                self.toggle_screen_watching().await;
            }
            "/model" => {
                if parts.len() > 1 {
                    let model = parts[1..].join(" ");
                    self.add_system_message(format!("Switched to model: {}", model));
                } else {
                    self.add_system_message(format!(
                        "Current model: {}",
                        self.settings.get_default_model()
                    ));
                }
            }
            "/status" => {
                let status = format!(
                    "Status:\n\
                     Model: {}\n\
                     Provider: {}\n\
                     Screen watching: {}\n\
                     Messages: {}",
                    self.settings.get_default_model(),
                    self.settings.get_default_provider(),
                    if self.screen_watching { "ON" } else { "OFF" },
                    self.messages.len()
                );
                self.add_system_message(status);
            }
            "/new" => {
                self.conversation_id = Uuid::new_v4().to_string();
                self.messages.clear();
                self.add_system_message("Started new conversation".to_string());
            }
            "/exit" => {
                self.running = false;
            }
            _ => {
                self.add_system_message(format!(
                    "Unknown command: {}. Type /help for available commands.",
                    command
                ));
            }
        }

        Ok(())
    }

    fn add_system_message(&mut self, content: String) {
        self.messages.push(ChatMessage {
            id: Uuid::new_v4().to_string(),
            role: MessageRole::System,
            content,
            timestamp: Local::now(),
            tool_calls: vec![],
            is_streaming: false,
        });
    }

    async fn toggle_screen_watching(&mut self) {
        self.screen_watching = !self.screen_watching;

        if self.screen_watching {
            match ScreenWatcher::new() {
                Ok(watcher) => {
                    self.screen_watcher = Some(watcher);
                    self.add_system_message(
                        "🖥️ Screen watching enabled. I can now see your screen.".to_string(),
                    );
                }
                Err(e) => {
                    self.screen_watching = false;
                    self.add_system_message(format!("Failed to enable screen watching: {}", e));
                }
            }
        } else {
            self.screen_watcher = None;
            self.add_system_message("🖥️ Screen watching disabled.".to_string());
        }
    }
}
