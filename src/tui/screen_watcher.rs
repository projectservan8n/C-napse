//! Screen watching functionality for desktop version
//!
//! Allows C-napse to see and understand what's on your screen,
//! enabling context-aware assistance.

use crate::error::{CnapseError, Result};
use std::time::{Duration, Instant};

#[cfg(feature = "screenshots")]
use screenshots::Screen;

/// Screen watcher for monitoring desktop activity
pub struct ScreenWatcher {
    /// Last screenshot hash for change detection
    last_hash: Option<u64>,
    /// Last check time
    last_check: Instant,
    /// Check interval
    interval: Duration,
    /// Last captured description
    last_description: Option<String>,
    /// Screen capture enabled
    enabled: bool,
}

impl ScreenWatcher {
    /// Create a new screen watcher
    pub fn new() -> Result<Self> {
        Ok(Self {
            last_hash: None,
            last_check: Instant::now(),
            interval: Duration::from_secs(2), // Check every 2 seconds
            last_description: None,
            enabled: true,
        })
    }

    /// Check for screen changes
    pub fn check_for_changes(&mut self) -> Option<String> {
        if !self.enabled {
            return None;
        }

        // Rate limit checks
        if self.last_check.elapsed() < self.interval {
            return None;
        }
        self.last_check = Instant::now();

        // Capture screen
        match self.capture_screen() {
            Ok(Some((hash, description))) => {
                let changed = self.last_hash.map(|h| h != hash).unwrap_or(true);
                self.last_hash = Some(hash);
                self.last_description = Some(description.clone());

                if changed {
                    Some(description)
                } else {
                    None
                }
            }
            Ok(None) => None,
            Err(e) => {
                tracing::warn!("Screen capture failed: {}", e);
                None
            }
        }
    }

    /// Capture current screen and return hash + description
    #[cfg(feature = "screenshots")]
    fn capture_screen(&self) -> Result<Option<(u64, String)>> {
        use sha2::{Sha256, Digest};

        let screens = Screen::all().map_err(|e| CnapseError::tool(format!("Failed to get screens: {}", e)))?;

        if let Some(screen) = screens.first() {
            let image = screen.capture().map_err(|e| CnapseError::tool(format!("Failed to capture: {}", e)))?;

            // Calculate hash of image for change detection
            let rgba = image.rgba();
            let mut hasher = Sha256::new();

            // Sample pixels for faster hashing (every 100th pixel)
            for (i, chunk) in rgba.chunks(4).enumerate() {
                if i % 100 == 0 {
                    hasher.update(chunk);
                }
            }

            let hash_result = hasher.finalize();
            let hash = u64::from_le_bytes(hash_result[..8].try_into().unwrap());

            // Basic description based on image properties
            let description = format!(
                "Screen {}x{} captured",
                image.width(),
                image.height()
            );

            Ok(Some((hash, description)))
        } else {
            Ok(None)
        }
    }

    #[cfg(not(feature = "screenshots"))]
    fn capture_screen(&self) -> Result<Option<(u64, String)>> {
        // Without screenshot feature, we can't capture
        Ok(None)
    }

    /// Get the current screen description
    pub fn get_current_description(&self) -> Option<&str> {
        self.last_description.as_deref()
    }

    /// Take a screenshot and save to file
    #[cfg(feature = "screenshots")]
    pub fn take_screenshot(&self, path: &std::path::Path) -> Result<()> {
        let screens = Screen::all().map_err(|e| CnapseError::tool(format!("Failed to get screens: {}", e)))?;

        if let Some(screen) = screens.first() {
            let image = screen.capture().map_err(|e| CnapseError::tool(format!("Failed to capture: {}", e)))?;

            image.save(path).map_err(|e| CnapseError::tool(format!("Failed to save screenshot: {}", e)))?;

            Ok(())
        } else {
            Err(CnapseError::tool("No screens available"))
        }
    }

    #[cfg(not(feature = "screenshots"))]
    pub fn take_screenshot(&self, _path: &std::path::Path) -> Result<()> {
        Err(CnapseError::tool("Screenshot feature not enabled"))
    }

    /// Get screenshot as base64 for sending to vision models
    #[cfg(feature = "screenshots")]
    pub fn get_screenshot_base64(&self) -> Result<String> {
        use base64::Engine;

        let screens = Screen::all().map_err(|e| CnapseError::tool(format!("Failed to get screens: {}", e)))?;

        if let Some(screen) = screens.first() {
            let image = screen.capture().map_err(|e| CnapseError::tool(format!("Failed to capture: {}", e)))?;

            // Resize for API (max 1920x1080)
            let width = image.width().min(1920);
            let height = image.height().min(1080);

            // Convert to PNG bytes
            let mut buffer = Vec::new();
            let mut cursor = std::io::Cursor::new(&mut buffer);

            image.save(&mut cursor).map_err(|e| CnapseError::tool(format!("Failed to encode: {}", e)))?;

            Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
        } else {
            Err(CnapseError::tool("No screens available"))
        }
    }

    #[cfg(not(feature = "screenshots"))]
    pub fn get_screenshot_base64(&self) -> Result<String> {
        Err(CnapseError::tool("Screenshot feature not enabled"))
    }

    /// Set the check interval
    pub fn set_interval(&mut self, interval: Duration) {
        self.interval = interval;
    }

    /// Enable or disable watching
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// Check if watching is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
}

/// Screen region for partial captures
#[derive(Debug, Clone)]
pub struct ScreenRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl ScreenRegion {
    /// Create a region for a specific area
    pub fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self { x, y, width, height }
    }

    /// Full screen region
    #[cfg(feature = "screenshots")]
    pub fn full_screen() -> Option<Self> {
        if let Ok(screens) = Screen::all() {
            screens.first().map(|s| {
                let info = s.display_info;
                Self {
                    x: info.x,
                    y: info.y,
                    width: info.width,
                    height: info.height,
                }
            })
        } else {
            None
        }
    }

    #[cfg(not(feature = "screenshots"))]
    pub fn full_screen() -> Option<Self> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_watcher_creation() {
        let watcher = ScreenWatcher::new();
        assert!(watcher.is_ok());
    }
}
