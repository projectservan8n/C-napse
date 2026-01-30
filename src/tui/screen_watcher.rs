//! Screen watching functionality for desktop version
//!
//! Allows C-napse to see and understand what's on your screen,
//! enabling context-aware assistance.

use crate::error::{CnapseError, Result};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

#[cfg(feature = "screenshots")]
use screenshots::Screen;

/// Screen capture result from background task
pub struct ScreenCaptureResult {
    pub hash: u64,
    pub description: String,
}

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
    /// Receiver for background capture results
    capture_receiver: Option<mpsc::UnboundedReceiver<ScreenCaptureResult>>,
    /// Flag to track if capture is in progress
    capture_in_progress: Arc<Mutex<bool>>,
}

impl ScreenWatcher {
    /// Create a new screen watcher
    pub fn new() -> Result<Self> {
        Ok(Self {
            last_hash: None,
            last_check: Instant::now(),
            interval: Duration::from_secs(3), // Check every 3 seconds (reduced frequency)
            last_description: None,
            enabled: true,
            capture_receiver: None,
            capture_in_progress: Arc::new(Mutex::new(false)),
        })
    }

    /// Check for screen changes (non-blocking)
    pub fn check_for_changes(&mut self) -> Option<String> {
        if !self.enabled {
            return None;
        }

        // First, check if we have any results from previous capture
        if let Some(receiver) = &mut self.capture_receiver {
            if let Ok(result) = receiver.try_recv() {
                // Reset in-progress flag
                if let Ok(mut in_progress) = self.capture_in_progress.lock() {
                    *in_progress = false;
                }

                let changed = self.last_hash.map(|h| h != result.hash).unwrap_or(true);
                self.last_hash = Some(result.hash);
                self.last_description = Some(result.description.clone());

                if changed {
                    return Some(result.description);
                }
            }
        }

        // Rate limit checks
        if self.last_check.elapsed() < self.interval {
            return None;
        }

        // Check if capture already in progress
        let in_progress = self.capture_in_progress.lock().ok().map(|g| *g).unwrap_or(false);
        if in_progress {
            return None;
        }

        self.last_check = Instant::now();

        // Start background capture
        self.start_background_capture();

        None
    }

    /// Start a background screen capture
    fn start_background_capture(&mut self) {
        // Mark as in progress
        if let Ok(mut in_progress) = self.capture_in_progress.lock() {
            *in_progress = true;
        }

        let (tx, rx) = mpsc::unbounded_channel();
        self.capture_receiver = Some(rx);

        // Spawn blocking task for screen capture
        tokio::task::spawn_blocking(move || {
            if let Ok(Some(result)) = Self::capture_screen_sync() {
                let _ = tx.send(result);
            }
        });
    }

    /// Synchronous screen capture (runs in blocking task)
    #[cfg(feature = "screenshots")]
    fn capture_screen_sync() -> Result<Option<ScreenCaptureResult>> {
        use sha2::{Digest, Sha256};

        let screens = Screen::all()
            .map_err(|e| CnapseError::tool(format!("Failed to get screens: {}", e)))?;

        if let Some(screen) = screens.first() {
            let image = screen
                .capture()
                .map_err(|e| CnapseError::tool(format!("Failed to capture: {}", e)))?;

            // Calculate hash of image for change detection
            let rgba = image.as_raw();
            let mut hasher = Sha256::new();

            // Sample pixels for faster hashing (every 200th pixel for speed)
            for (i, chunk) in rgba.chunks(4).enumerate() {
                if i % 200 == 0 {
                    hasher.update(chunk);
                }
            }

            let hash_result = hasher.finalize();
            let hash = u64::from_le_bytes(hash_result[..8].try_into().unwrap());

            // Basic description based on image properties
            let description = format!("Screen {}x{} captured", image.width(), image.height());

            Ok(Some(ScreenCaptureResult { hash, description }))
        } else {
            Ok(None)
        }
    }

    #[cfg(not(feature = "screenshots"))]
    fn capture_screen_sync() -> Result<Option<ScreenCaptureResult>> {
        Ok(None)
    }

    /// Get the current screen description
    pub fn get_current_description(&self) -> Option<&str> {
        self.last_description.as_deref()
    }

    /// Take a screenshot and save to file
    #[cfg(feature = "screenshots")]
    pub fn take_screenshot(&self, path: &std::path::Path) -> Result<()> {
        use image::ImageEncoder;

        let screens = Screen::all()
            .map_err(|e| CnapseError::tool(format!("Failed to get screens: {}", e)))?;

        if let Some(screen) = screens.first() {
            let img = screen
                .capture()
                .map_err(|e| CnapseError::tool(format!("Failed to capture: {}", e)))?;

            // Save using the image crate
            let file = std::fs::File::create(path)
                .map_err(|e| CnapseError::tool(format!("Failed to create file: {}", e)))?;
            let mut writer = std::io::BufWriter::new(file);
            let encoder = image::codecs::png::PngEncoder::new(&mut writer);
            encoder
                .write_image(
                    img.as_raw(),
                    img.width(),
                    img.height(),
                    image::ColorType::Rgba8,
                )
                .map_err(|e| CnapseError::tool(format!("Failed to save screenshot: {}", e)))?;

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
        use image::ImageEncoder;

        let screens = Screen::all()
            .map_err(|e| CnapseError::tool(format!("Failed to get screens: {}", e)))?;

        if let Some(screen) = screens.first() {
            let img = screen
                .capture()
                .map_err(|e| CnapseError::tool(format!("Failed to capture: {}", e)))?;

            // Convert to PNG bytes
            let mut buffer = Vec::new();
            {
                let encoder = image::codecs::png::PngEncoder::new(&mut buffer);
                encoder
                    .write_image(
                        img.as_raw(),
                        img.width(),
                        img.height(),
                        image::ColorType::Rgba8,
                    )
                    .map_err(|e| CnapseError::tool(format!("Failed to encode: {}", e)))?;
            }

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
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ScreenRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[allow(dead_code)]
impl ScreenRegion {
    /// Create a region for a specific area
    pub fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
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
