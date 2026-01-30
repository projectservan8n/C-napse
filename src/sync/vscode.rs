//! VS Code integration

use crate::error::{CnapseError, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// VS Code workspace information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VscodeWorkspace {
    pub root: PathBuf,
    pub name: String,
    pub open_files: Vec<PathBuf>,
}

/// Check if VS Code is running
pub fn is_vscode_running() -> bool {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_processes();

    sys.processes().values().any(|p| {
        let name = p.name().to_str().unwrap_or("").to_lowercase();
        name.contains("code") || name.contains("code-insiders") || name.contains("codium")
    })
}

/// Get VS Code workspace from current directory
pub fn detect_workspace() -> Option<VscodeWorkspace> {
    let cwd = std::env::current_dir().ok()?;

    // Check for .vscode folder or workspace file
    let vscode_dir = cwd.join(".vscode");
    let is_workspace = vscode_dir.exists()
        || cwd.join(".code-workspace").exists()
        || cwd.join("*.code-workspace").exists();

    if is_workspace || cwd.join(".git").exists() {
        let name = cwd.file_name()?.to_string_lossy().to_string();

        Some(VscodeWorkspace {
            root: cwd,
            name,
            open_files: Vec::new(),
        })
    } else {
        None
    }
}

/// Open file in VS Code
pub fn open_in_vscode(path: &str) -> Result<()> {
    let editors = ["code", "code-insiders", "codium"];

    for editor in editors {
        if std::process::Command::new(editor)
            .arg(path)
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
    }

    Err(CnapseError::tool("VS Code not found"))
}

/// Open workspace in VS Code
pub fn open_workspace(path: &str) -> Result<()> {
    let editors = ["code", "code-insiders", "codium"];

    for editor in editors {
        if std::process::Command::new(editor)
            .arg("--new-window")
            .arg(path)
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
    }

    Err(CnapseError::tool("VS Code not found"))
}

/// Get VS Code settings path
pub fn get_settings_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;

    #[cfg(target_os = "windows")]
    let settings_path = home.join("AppData/Roaming/Code/User/settings.json");

    #[cfg(target_os = "macos")]
    let settings_path = home.join("Library/Application Support/Code/User/settings.json");

    #[cfg(target_os = "linux")]
    let settings_path = home.join(".config/Code/User/settings.json");

    if settings_path.exists() {
        Some(settings_path)
    } else {
        None
    }
}
