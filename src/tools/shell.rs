//! Shell command execution tools

use super::ToolResult;
use std::process::Command;

/// Run a shell command
pub fn run_command(cmd: &str) -> ToolResult {
    let output = if cfg!(windows) {
        Command::new("cmd")
            .args(["/C", cmd])
            .output()
    } else {
        Command::new("sh")
            .args(["-c", cmd])
            .output()
    };

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            if output.status.success() {
                if stderr.is_empty() {
                    ToolResult::ok(stdout.to_string())
                } else {
                    ToolResult::ok(format!("{}\n[stderr]: {}", stdout, stderr))
                }
            } else {
                ToolResult {
                    success: false,
                    output: stdout.to_string(),
                    error: Some(format!(
                        "Exit code: {}\n{}",
                        output.status.code().unwrap_or(-1),
                        stderr
                    )),
                }
            }
        }
        Err(e) => ToolResult::err(format!("Failed to execute command: {}", e)),
    }
}

/// Get environment variable
pub fn get_env(var: &str) -> ToolResult {
    match std::env::var(var) {
        Ok(value) => ToolResult::ok(value),
        Err(_) => ToolResult::err(format!("Environment variable not set: {}", var)),
    }
}

/// Set environment variable (for current process)
pub fn set_env(var: &str, value: &str) -> ToolResult {
    std::env::set_var(var, value);
    ToolResult::ok(format!("Set {}={}", var, value))
}

/// Get current working directory
pub fn get_cwd() -> ToolResult {
    match std::env::current_dir() {
        Ok(path) => ToolResult::ok(path.to_string_lossy().to_string()),
        Err(e) => ToolResult::err(format!("Failed to get working directory: {}", e)),
    }
}

/// Change current working directory
pub fn set_cwd(path: &str) -> ToolResult {
    match std::env::set_current_dir(path) {
        Ok(()) => ToolResult::ok(format!("Changed directory to: {}", path)),
        Err(e) => ToolResult::err(format!("Failed to change directory: {}", e)),
    }
}
