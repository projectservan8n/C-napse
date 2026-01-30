//! Telegram bot integration

pub mod bot;
pub mod commands;
pub mod handlers;

use crate::config::{Credentials, Settings};
use crate::error::{CnapseError, Result};

/// Start the Telegram bot
pub async fn start_bot(settings: Settings) -> Result<()> {
    let credentials = Credentials::load()?;

    let token = credentials
        .telegram
        .bot_token
        .ok_or_else(|| CnapseError::auth("No Telegram bot token configured"))?;

    bot::run_bot(token, settings).await
}
