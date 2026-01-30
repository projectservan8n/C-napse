//! Clipboard tools

use super::ToolResult;
use arboard::Clipboard;

/// Get clipboard contents
pub fn get_clipboard() -> ToolResult {
    match Clipboard::new() {
        Ok(mut clipboard) => match clipboard.get_text() {
            Ok(text) => ToolResult::ok(text),
            Err(e) => ToolResult::err(format!("Failed to get clipboard: {}", e)),
        },
        Err(e) => ToolResult::err(format!("Failed to access clipboard: {}", e)),
    }
}

/// Set clipboard contents
pub fn set_clipboard(text: &str) -> ToolResult {
    match Clipboard::new() {
        Ok(mut clipboard) => match clipboard.set_text(text) {
            Ok(()) => ToolResult::ok(format!("Copied {} characters to clipboard", text.len())),
            Err(e) => ToolResult::err(format!("Failed to set clipboard: {}", e)),
        },
        Err(e) => ToolResult::err(format!("Failed to access clipboard: {}", e)),
    }
}
