//! Telegram bot command definitions

use teloxide::utils::command::BotCommands;

#[derive(BotCommands, Clone)]
#[command(rename_rule = "lowercase", description = "C-napse Commands:")]
pub enum Command {
    #[command(description = "Show welcome message")]
    Start,

    #[command(description = "Show available commands")]
    Help,

    #[command(description = "Show PC status")]
    Status,

    #[command(description = "Execute query on PC")]
    Run(String),

    #[command(description = "Run shell command")]
    Shell(String),

    #[command(description = "Get file contents")]
    File(String),

    #[command(description = "Take screenshot")]
    Screenshot,

    #[command(description = "List available apps")]
    Apps,

    #[command(description = "Show recent commands")]
    History,

    #[command(description = "Cancel current operation")]
    Cancel,
}
