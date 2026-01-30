//! cnapse telegram command - Manage Telegram bot

use crate::cli::ui;
use crate::config::{Credentials, Settings};
use crate::error::{CnapseError, Result};
use clap::{Args, Subcommand};

#[derive(Args, Debug)]
pub struct TelegramArgs {
    #[command(subcommand)]
    pub command: TelegramCommand,
}

#[derive(Subcommand, Debug)]
pub enum TelegramCommand {
    /// Start the Telegram bot
    Start {
        /// Run in background (daemon mode)
        #[arg(long)]
        daemon: bool,
    },

    /// Stop the Telegram bot
    Stop,

    /// Show bot status
    Status,

    /// Configure bot token
    Setup,

    /// Manage allowed users
    Users {
        #[command(subcommand)]
        command: UsersCommand,
    },
}

#[derive(Subcommand, Debug)]
pub enum UsersCommand {
    /// Add allowed user
    Add {
        /// Telegram user ID
        user_id: i64,
    },

    /// Remove allowed user
    Remove {
        /// Telegram user ID
        user_id: i64,
    },

    /// List allowed users
    List,
}

pub async fn execute(args: TelegramArgs, settings: Option<Settings>) -> Result<()> {
    match args.command {
        TelegramCommand::Start { daemon } => start(daemon, settings).await,
        TelegramCommand::Stop => stop().await,
        TelegramCommand::Status => status(settings).await,
        TelegramCommand::Setup => setup().await,
        TelegramCommand::Users { command } => match command {
            UsersCommand::Add { user_id } => users_add(user_id, settings).await,
            UsersCommand::Remove { user_id } => users_remove(user_id, settings).await,
            UsersCommand::List => users_list(settings).await,
        },
    }
}

async fn start(daemon: bool, settings: Option<Settings>) -> Result<()> {
    let settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    // Check for bot token
    let credentials = Credentials::load()?;
    if credentials.telegram.bot_token.is_none() {
        return Err(CnapseError::auth(
            "No Telegram bot token configured. Run 'cnapse telegram setup' first.",
        ));
    }

    ui::header("Starting Telegram Bot");

    let allowed_users = &settings.telegram.allowed_users;
    if allowed_users.is_empty() {
        ui::warning("No allowed users configured - bot will accept all users!");
        ui::info("Add users with: cnapse telegram users add <user_id>");
    } else {
        ui::info(&format!("Allowed users: {}", allowed_users.len()));
    }

    if daemon {
        ui::info("Starting in background...");
        // TODO: Implement daemon mode
        ui::warning("Daemon mode not yet implemented.");
        return Ok(());
    }

    ui::info("Starting bot (press Ctrl+C to stop)...");
    println!();

    // Start the bot
    crate::telegram::start_bot(settings).await?;

    Ok(())
}

async fn stop() -> Result<()> {
    // TODO: Implement stop for daemon mode
    ui::info("Telegram bot stop not yet implemented.");
    ui::info("Use Ctrl+C to stop the bot if running in foreground.");
    Ok(())
}

async fn status(settings: Option<Settings>) -> Result<()> {
    ui::header("Telegram Bot Status");

    let credentials = Credentials::load().unwrap_or_default();
    let has_token = credentials.telegram.bot_token.is_some();

    ui::kv(
        "Bot token",
        if has_token { "configured" } else { "not set" },
    );

    if let Some(settings) = settings {
        ui::kv("Enabled", &settings.telegram.enabled.to_string());
        ui::kv(
            "Allowed users",
            &format!("{}", settings.telegram.allowed_users.len()),
        );

        if !settings.telegram.webhook_url.is_empty() {
            ui::kv("Webhook", &settings.telegram.webhook_url);
        }
    }

    // TODO: Check if bot is actually running

    println!();
    Ok(())
}

async fn setup() -> Result<()> {
    ui::header("Telegram Bot Setup");

    println!();
    ui::info("To create a Telegram bot:");
    ui::list_item("1. Open Telegram and search for @BotFather");
    ui::list_item("2. Send /newbot and follow the instructions");
    ui::list_item("3. Copy the bot token provided");
    println!();

    if let Some(token) = ui::password("Enter bot token") {
        // Validate token format (basic check)
        if !token.contains(':') {
            return Err(CnapseError::invalid_input(
                "Invalid token format. Token should contain ':'",
            ));
        }

        let mut credentials = Credentials::load().unwrap_or_default();
        credentials.telegram.bot_token = Some(token);
        credentials.save()?;

        ui::success("Telegram bot token saved!");
        println!();
        ui::info("Next steps:");
        ui::list_item("cnapse telegram users add <your_user_id>");
        ui::list_item("cnapse telegram start");
    } else {
        ui::info("Setup cancelled.");
    }

    Ok(())
}

async fn users_add(user_id: i64, settings: Option<Settings>) -> Result<()> {
    let mut settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    if settings.telegram.allowed_users.contains(&user_id) {
        ui::info(&format!("User {} is already in the allowed list.", user_id));
        return Ok(());
    }

    settings.telegram.allowed_users.push(user_id);
    settings.save()?;

    ui::success(&format!("Added user {} to allowed list.", user_id));
    Ok(())
}

async fn users_remove(user_id: i64, settings: Option<Settings>) -> Result<()> {
    let mut settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    if !settings.telegram.allowed_users.contains(&user_id) {
        ui::info(&format!("User {} is not in the allowed list.", user_id));
        return Ok(());
    }

    settings.telegram.allowed_users.retain(|&id| id != user_id);
    settings.save()?;

    ui::success(&format!("Removed user {} from allowed list.", user_id));
    Ok(())
}

async fn users_list(settings: Option<Settings>) -> Result<()> {
    let settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    ui::header("Allowed Telegram Users");

    if settings.telegram.allowed_users.is_empty() {
        ui::info("No users configured (bot accepts all users).");
        println!();
        ui::info("Add users with: cnapse telegram users add <user_id>");
        println!();
        ui::info("To get your Telegram user ID:");
        ui::list_item("1. Message @userinfobot on Telegram");
        ui::list_item("2. It will reply with your user ID");
    } else {
        for user_id in &settings.telegram.allowed_users {
            ui::list_item(&user_id.to_string());
        }
    }

    println!();
    Ok(())
}
