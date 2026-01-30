//! Screenshot tools

use super::ToolResult;
use std::path::Path;

/// Take a screenshot
pub fn take_screenshot(output_path: Option<&str>) -> ToolResult {
    // Get default output path
    let path = output_path.unwrap_or("screenshot.png");

    // Use the screenshots crate
    match screenshots::Screen::all() {
        Ok(screens) => {
            if screens.is_empty() {
                return ToolResult::err("No screens found");
            }

            // Capture primary screen
            match screens[0].capture() {
                Ok(image) => {
                    // Save to file
                    match image.save(path) {
                        Ok(()) => ToolResult::ok(format!(
                            "Screenshot saved to: {}\nSize: {}x{}",
                            path,
                            image.width(),
                            image.height()
                        )),
                        Err(e) => ToolResult::err(format!("Failed to save screenshot: {}", e)),
                    }
                }
                Err(e) => ToolResult::err(format!("Failed to capture screen: {}", e)),
            }
        }
        Err(e) => ToolResult::err(format!("Failed to get screens: {}", e)),
    }
}

/// List available screens
pub fn list_screens() -> ToolResult {
    match screenshots::Screen::all() {
        Ok(screens) => {
            let info: Vec<String> = screens
                .iter()
                .enumerate()
                .map(|(i, screen)| {
                    format!(
                        "Screen {}: {}x{} at ({}, {})",
                        i,
                        screen.display_info.width,
                        screen.display_info.height,
                        screen.display_info.x,
                        screen.display_info.y
                    )
                })
                .collect();

            ToolResult::ok(info.join("\n"))
        }
        Err(e) => ToolResult::err(format!("Failed to get screens: {}", e)),
    }
}
