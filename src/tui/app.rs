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
use tokio::sync::mpsc;
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

/// Message from background task
pub enum BackgroundMessage {
    /// Response received from LLM
    Response { msg_id: String, content: String },
    /// Error occurred
    Error { msg_id: String, error: String },
    /// Status update
    Status(String),
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
    /// Channel receiver for background messages
    pub bg_receiver: Option<mpsc::UnboundedReceiver<BackgroundMessage>>,
    /// Current processing message ID
    pub current_msg_id: Option<String>,
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
            bg_receiver: None,
            current_msg_id: None,
        })
    }

    pub async fn run<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()> {
        while self.running {
            // Draw UI
            terminal.draw(|f| self.draw(f))?;

            // Check for background messages (non-blocking)
            if let Some(receiver) = &mut self.bg_receiver {
                while let Ok(msg) = receiver.try_recv() {
                    match msg {
                        BackgroundMessage::Response { msg_id, content } => {
                            if let Some(m) = self.messages.iter_mut().find(|m| m.id == msg_id) {
                                m.content = content;
                                m.is_streaming = false;
                            }
                            self.processing = false;
                            self.status = "Ready".to_string();
                            self.current_msg_id = None;
                            // Auto-scroll to bottom
                            self.scroll = self.messages.len().saturating_sub(1);
                        }
                        BackgroundMessage::Error { msg_id, error } => {
                            if let Some(m) = self.messages.iter_mut().find(|m| m.id == msg_id) {
                                m.content = format!("Error: {}", error);
                                m.is_streaming = false;
                            }
                            self.processing = false;
                            self.status = "Ready".to_string();
                            self.current_msg_id = None;
                        }
                        BackgroundMessage::Status(status) => {
                            self.status = status;
                        }
                    }
                }
            }

            // Handle events with timeout (short for responsiveness)
            if event::poll(Duration::from_millis(50))? {
                if let Event::Key(key) = event::read()? {
                    if key.kind == KeyEventKind::Press {
                        self.handle_key(key.code, key.modifiers).await?;
                    }
                }
            }

            // Check screen watcher (less frequently to avoid blocking)
            if self.screen_watching && !self.processing {
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

        // Add assistant message placeholder with "thinking" indicator
        let assistant_msg_id = Uuid::new_v4().to_string();
        self.messages.push(ChatMessage {
            id: assistant_msg_id.clone(),
            role: MessageRole::Assistant,
            content: "Thinking...".to_string(),
            timestamp: Local::now(),
            tool_calls: vec![],
            is_streaming: true,
        });

        self.current_msg_id = Some(assistant_msg_id.clone());

        // Create channel for background communication
        let (tx, rx) = mpsc::unbounded_channel();
        self.bg_receiver = Some(rx);

        // Clone what we need for the background task
        let settings = self.settings.clone();
        let messages_for_context: Vec<AgentMessage> = self
            .messages
            .iter()
            .filter(|m| matches!(m.role, MessageRole::User | MessageRole::Assistant))
            .filter(|m| !m.is_streaming) // Exclude the placeholder
            .take(10)
            .map(|m| AgentMessage {
                role: m.role.clone(),
                content: m.content.clone(),
                metadata: None,
            })
            .collect();

        let screen_context = if self.screen_watching {
            self.screen_watcher
                .as_ref()
                .and_then(|w| w.get_current_description())
        } else {
            None
        };

        let conversation_id = self.conversation_id.clone();

        // Spawn background task for API call
        tokio::spawn(async move {
            let result = Self::process_in_background(
                settings,
                messages_for_context,
                user_input,
                screen_context,
                conversation_id,
            )
            .await;

            match result {
                Ok(response) => {
                    let _ = tx.send(BackgroundMessage::Response {
                        msg_id: assistant_msg_id,
                        content: response,
                    });
                }
                Err(e) => {
                    let _ = tx.send(BackgroundMessage::Error {
                        msg_id: assistant_msg_id,
                        error: e.to_string(),
                    });
                }
            }
        });

        Ok(())
    }

    /// Process message in background (static method to avoid borrowing issues)
    async fn process_in_background(
        settings: Settings,
        context_messages: Vec<AgentMessage>,
        user_input: String,
        screen_context: Option<String>,
        _conversation_id: String,
    ) -> Result<String> {
        use crate::tui::tools_description;

        // Add screen context if available
        let context = if let Some(desc) = screen_context {
            format!("[Current screen: {}]\n\n{}", desc, user_input)
        } else {
            user_input
        };

        // Create inference request
        let backend = create_backend(&settings).await?;

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
        all_messages.extend(context_messages);
        all_messages.push(AgentMessage {
            role: MessageRole::User,
            content: context,
            metadata: None,
        });

        let request = InferenceRequest {
            model: settings.get_default_model(),
            messages: all_messages,
            temperature: 0.7,
            max_tokens: 2048,
            stop: vec![],
            stream: false,
        };

        let response = backend.infer(request).await?;
        Ok(response.content)
    }


    async fn handle_command(&mut self, cmd: &str) -> Result<()> {
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        let command = parts.first().copied().unwrap_or("");

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
