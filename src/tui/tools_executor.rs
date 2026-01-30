//! Tool execution integration for TUI
//!
//! Executes tools and streams results back to the chat interface

use crate::error::{CnapseError, Result};
use crate::tools::{clipboard, filesystem, process, shell};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tool execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolRequest {
    pub name: String,
    pub args: HashMap<String, serde_json::Value>,
}

/// Tool execution result
#[derive(Debug, Clone)]
pub struct ToolResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

/// Tool executor for running tools within the TUI
pub struct ToolExecutor {
    /// Whether to show verbose output
    verbose: bool,
}

impl ToolExecutor {
    pub fn new() -> Self {
        Self { verbose: false }
    }

    pub fn verbose(mut self, verbose: bool) -> Self {
        self.verbose = verbose;
        self
    }

    /// Execute a tool and return the result
    pub async fn execute(&self, request: &ToolRequest) -> Result<ToolResult> {
        match request.name.as_str() {
            // File operations
            "read_file" => {
                let path = self.get_string_arg(&request.args, "path")?;
                let result = filesystem::read_file(&path);
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            "write_file" => {
                let path = self.get_string_arg(&request.args, "path")?;
                let content = self.get_string_arg(&request.args, "content")?;
                let result = filesystem::write_file(&path, &content);
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            "list_dir" => {
                let path = self
                    .get_string_arg(&request.args, "path")
                    .unwrap_or_else(|_| ".".to_string());
                let result = filesystem::list_dir(&path, false);
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            // Shell commands
            "shell" | "run_command" => {
                let command = self.get_string_arg(&request.args, "command")?;
                let result = shell::run_command(&command);
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            // Clipboard
            "copy_to_clipboard" => {
                let text = self.get_string_arg(&request.args, "text")?;
                let result = clipboard::set_clipboard(&text);
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            "read_clipboard" => {
                let result = clipboard::get_clipboard();
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            // Process management
            "list_processes" => {
                let result = process::list_processes();
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            "kill_process" => {
                let pid = self.get_int_arg(&request.args, "pid")? as u32;
                let result = process::kill_process(pid);
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            // Screenshot
            "screenshot" => {
                let path = request.args.get("path").and_then(|v| v.as_str());

                use crate::tools::screenshot;
                let result = screenshot::take_screenshot(path);
                Ok(ToolResult {
                    success: result.success,
                    output: result.output,
                    error: result.error,
                })
            }

            // Unknown tool
            _ => Ok(ToolResult {
                success: false,
                output: String::new(),
                error: Some(format!("Unknown tool: {}", request.name)),
            }),
        }
    }

    fn get_string_arg(
        &self,
        args: &HashMap<String, serde_json::Value>,
        key: &str,
    ) -> Result<String> {
        args.get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| CnapseError::tool(format!("Missing argument: {}", key)))
    }

    fn get_int_arg(&self, args: &HashMap<String, serde_json::Value>, key: &str) -> Result<i64> {
        args.get(key)
            .and_then(|v| v.as_i64())
            .ok_or_else(|| CnapseError::tool(format!("Missing argument: {}", key)))
    }
}

/// Parse tool calls from assistant response
pub fn parse_tool_calls(response: &str) -> Vec<ToolRequest> {
    let mut tools = Vec::new();

    // Look for tool calls in various formats:
    // 1. JSON format: {"tool": "name", "args": {...}}
    // 2. Markdown format: ```tool:name\nargs\n```
    // 3. Inline format: [TOOL: name(args)]

    // Try JSON format
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(response) {
        if let Some(tool) = json.get("tool").and_then(|t| t.as_str()) {
            let args = json
                .get("args")
                .and_then(|a| a.as_object())
                .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                .unwrap_or_default();

            tools.push(ToolRequest {
                name: tool.to_string(),
                args,
            });
        }
    }

    // Look for inline format [TOOL: name(arg1, arg2)]
    let re = regex::Regex::new(r"\[TOOL:\s*(\w+)\(([^)]*)\)\]").ok();
    if let Some(re) = re {
        for cap in re.captures_iter(response) {
            let name = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let args_str = cap.get(2).map(|m| m.as_str()).unwrap_or("");

            let mut args = HashMap::new();
            for (i, arg) in args_str.split(',').enumerate() {
                let arg = arg.trim();
                if !arg.is_empty() {
                    // Try to parse as key=value
                    if let Some((key, value)) = arg.split_once('=') {
                        args.insert(
                            key.trim().to_string(),
                            serde_json::Value::String(value.trim().to_string()),
                        );
                    } else {
                        args.insert(
                            format!("arg{}", i),
                            serde_json::Value::String(arg.to_string()),
                        );
                    }
                }
            }

            if !name.is_empty() {
                tools.push(ToolRequest {
                    name: name.to_string(),
                    args,
                });
            }
        }
    }

    tools
}

/// Available tools description for the system prompt
pub fn tools_description() -> &'static str {
    r#"You have access to the following tools:

## File Operations
- read_file(path): Read contents of a file
- write_file(path, content): Write content to a file
- list_dir(path): List files in a directory

## Shell Commands
- shell(command): Execute a shell command

## Clipboard
- copy_to_clipboard(text): Copy text to clipboard
- read_clipboard(): Read text from clipboard

## Process Management
- list_processes(): List running processes
- kill_process(pid): Kill a process by PID

## Network
- http_get(url): Make an HTTP GET request

## Screenshots
- screenshot(path?): Take a screenshot

To use a tool, include it in your response like: [TOOL: tool_name(arg1=value1, arg2=value2)]
"#
}
