//! Telegram bot implementation

use crate::config::Settings;
use crate::error::{CnapseError, Result};
use teloxide::prelude::*;

/// Run the Telegram bot
pub async fn run_bot(token: String, settings: Settings) -> Result<()> {
    tracing::info!("Starting Telegram bot...");

    let bot = Bot::new(token);
    let allowed_users = settings.telegram.allowed_users.clone();

    // Simple echo handler for now
    teloxide::repl(bot, move |bot: Bot, msg: Message| {
        let allowed = allowed_users.clone();

        async move {
            // Check authorization
            if let Some(user) = msg.from {
                if !allowed.is_empty() && !allowed.contains(&(user.id.0 as i64)) {
                    bot.send_message(msg.chat.id, "❌ Unauthorized").await?;
                    return Ok(());
                }
            }

            // Handle message
            if let Some(text) = msg.text() {
                if text.starts_with('/') {
                    // Handle commands
                    let response = handle_command(text).await;
                    bot.send_message(msg.chat.id, response).await?;
                } else {
                    // Handle natural language
                    let response = format!("Echo: {}", text);
                    bot.send_message(msg.chat.id, response).await?;
                }
            }

            Ok(())
        }
    })
    .await;

    Ok(())
}

async fn handle_command(text: &str) -> String {
    let parts: Vec<&str> = text.splitn(2, ' ').collect();
    let command = parts[0].trim_start_matches('/');
    let args = parts.get(1).map(|s| *s).unwrap_or("");

    match command {
        "start" => {
            r#"🤖 Welcome to C-napse!

I'm your PC automation assistant. Here's what I can do:

/help - Show commands
/status - PC status
/run <query> - Execute query
/shell <cmd> - Run shell command
/screenshot - Take screenshot
/apps - List apps

Just send me a message and I'll help you control your PC!"#
                .to_string()
        }

        "help" => {
            r#"📚 C-napse Commands

/start - Welcome message
/help - Show this help
/status - Show PC status
/run <query> - Execute query on PC
/shell <cmd> - Run shell command
/file <path> - Get file contents
/screenshot - Take screenshot
/apps - List available apps
/history - Recent commands
/cancel - Cancel operation"#
                .to_string()
        }

        "status" => {
            let sys = sysinfo::System::new_all();

            format!(
                r#"📊 PC Status

🖥️ OS: {} {}
💾 Memory: {:.1} GB / {:.1} GB
🔧 CPUs: {}
⏱️ Uptime: {}h {}m"#,
                sysinfo::System::name().unwrap_or_default(),
                sysinfo::System::os_version().unwrap_or_default(),
                sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0,
                sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0,
                sys.cpus().len(),
                sysinfo::System::uptime() / 3600,
                (sysinfo::System::uptime() % 3600) / 60
            )
        }

        "run" => {
            if args.is_empty() {
                "Usage: /run <query>".to_string()
            } else {
                format!("🔄 Processing: {}\n\n(Full inference not yet implemented)", args)
            }
        }

        "shell" => {
            if args.is_empty() {
                "Usage: /shell <command>".to_string()
            } else {
                // Execute command
                let result = crate::tools::shell::run_command(args);
                if result.success {
                    format!("✅ Output:\n```\n{}\n```", result.output)
                } else {
                    format!(
                        "❌ Error:\n```\n{}\n```",
                        result.error.unwrap_or_default()
                    )
                }
            }
        }

        "screenshot" => "📸 Screenshot capture not yet implemented via Telegram.".to_string(),

        "apps" => {
            let paths = match crate::config::Paths::new(None) {
                Ok(p) => p,
                Err(_) => return "❌ Failed to get paths".to_string(),
            };

            let apps = paths.list_apps().unwrap_or_default();

            if apps.is_empty() {
                "📱 No apps created yet.\n\nCreate apps with: cnapse app create \"App Name\"".to_string()
            } else {
                let list: Vec<String> = apps
                    .iter()
                    .filter_map(|p| {
                        p.file_name()
                            .map(|n| format!("• {}", n.to_string_lossy()))
                    })
                    .collect();

                format!("📱 Your Apps:\n\n{}", list.join("\n"))
            }
        }

        "cancel" => "✅ Operation cancelled.".to_string(),

        _ => format!("❓ Unknown command: /{}\n\nType /help for available commands.", command),
    }
}
