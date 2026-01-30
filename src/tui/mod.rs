//! Terminal User Interface for C-napse
//!
//! Provides a Claude Code-like interactive chat experience with:
//! - Real-time streaming responses
//! - Tool execution visualization
//! - Screen watching capability
//! - Keyboard shortcuts

mod app;
mod events;
mod ui;
mod screen_watcher;
mod tools_executor;

pub use app::TuiApp;
pub use screen_watcher::ScreenWatcher;
pub use tools_executor::{ToolExecutor, ToolRequest, ToolResult, parse_tool_calls, tools_description};

use crate::error::Result;
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    Terminal,
};
use std::io;

/// Launch the TUI application
pub async fn run() -> Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app and run
    let mut app = TuiApp::new().await?;
    let result = app.run(&mut terminal).await;

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    result
}
