//! Event handling for the TUI

use crossterm::event::{Event, KeyCode, KeyEvent, KeyModifiers};
use std::time::Duration;
use tokio::sync::mpsc;

/// Application events
#[allow(dead_code)]
#[derive(Debug)]
pub enum AppEvent {
    /// Key press
    Key(KeyEvent),
    /// Terminal resize
    Resize(u16, u16),
    /// Tick for updates
    Tick,
    /// Screen change detected
    ScreenChange(String),
    /// Inference response chunk
    ResponseChunk(String),
    /// Inference complete
    ResponseComplete,
    /// Tool started
    ToolStarted(String),
    /// Tool completed
    ToolCompleted(String, String),
    /// Error occurred
    Error(String),
}

/// Event handler for async event processing
#[allow(dead_code)]
pub struct EventHandler {
    rx: mpsc::UnboundedReceiver<AppEvent>,
    _tx: mpsc::UnboundedSender<AppEvent>,
}

impl EventHandler {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let _tx = tx.clone();

        // Spawn event polling task
        let event_tx = tx.clone();
        tokio::spawn(async move {
            loop {
                // Poll for events
                if crossterm::event::poll(Duration::from_millis(100)).unwrap_or(false) {
                    if let Ok(event) = crossterm::event::read() {
                        let app_event = match event {
                            Event::Key(key) => Some(AppEvent::Key(key)),
                            Event::Resize(w, h) => Some(AppEvent::Resize(w, h)),
                            _ => None,
                        };

                        if let Some(e) = app_event {
                            if event_tx.send(e).is_err() {
                                break;
                            }
                        }
                    }
                }

                // Send tick
                if event_tx.send(AppEvent::Tick).is_err() {
                    break;
                }

                tokio::time::sleep(Duration::from_millis(50)).await;
            }
        });

        Self { rx, _tx }
    }

    pub fn sender(&self) -> mpsc::UnboundedSender<AppEvent> {
        self._tx.clone()
    }

    pub async fn next(&mut self) -> Option<AppEvent> {
        self.rx.recv().await
    }
}

/// Key binding configuration
#[allow(dead_code)]
pub struct KeyBindings {
    pub exit: (KeyCode, KeyModifiers),
    pub clear: (KeyCode, KeyModifiers),
    pub toggle_watch: (KeyCode, KeyModifiers),
    pub submit: KeyCode,
    pub history_up: KeyCode,
    pub history_down: KeyCode,
    pub scroll_up: KeyCode,
    pub scroll_down: KeyCode,
}

impl Default for KeyBindings {
    fn default() -> Self {
        Self {
            exit: (KeyCode::Char('c'), KeyModifiers::CONTROL),
            clear: (KeyCode::Char('l'), KeyModifiers::CONTROL),
            toggle_watch: (KeyCode::Char('w'), KeyModifiers::CONTROL),
            submit: KeyCode::Enter,
            history_up: KeyCode::Up,
            history_down: KeyCode::Down,
            scroll_up: KeyCode::PageUp,
            scroll_down: KeyCode::PageDown,
        }
    }
}
