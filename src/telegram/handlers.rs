//! Message handlers for Telegram bot

use crate::config::Settings;

/// Check if a user is authorized
pub fn is_authorized(user_id: i64, allowed_users: &[i64]) -> bool {
    allowed_users.is_empty() || allowed_users.contains(&user_id)
}

/// Handle text message (natural language query)
pub async fn handle_text_message(text: &str, _settings: &Settings) -> String {
    // Route the query through the agent system
    // For now, return a placeholder
    format!(
        "🤔 Processing: {}\n\n(Full inference not yet implemented. Use /shell <cmd> for direct commands.)",
        text
    )
}

/// Handle file request
pub async fn handle_file_request(path: &str) -> String {
    let result = crate::tools::filesystem::read_file(path);

    if result.success {
        if result.output.len() > 4000 {
            format!(
                "📄 File: {}\n\n(Content too long, showing first 4000 chars)\n\n```\n{}\n```",
                path,
                &result.output[..4000]
            )
        } else {
            format!("📄 File: {}\n\n```\n{}\n```", path, result.output)
        }
    } else {
        format!(
            "❌ Failed to read file: {}",
            result.error.unwrap_or_default()
        )
    }
}

/// Format shell output for Telegram
pub fn format_shell_output(output: &str, error: Option<&str>) -> String {
    let truncate = |s: &str, max: usize| -> String {
        if s.len() > max {
            format!("{}...(truncated)", &s[..max])
        } else {
            s.to_string()
        }
    };

    match error {
        Some(e) => format!(
            "❌ Error:\n```\n{}\n```\n\nOutput:\n```\n{}\n```",
            truncate(e, 1000),
            truncate(output, 2000)
        ),
        None => format!("✅ Output:\n```\n{}\n```", truncate(output, 3000)),
    }
}
