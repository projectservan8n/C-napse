//! cnapse sync command - Phone and VS Code synchronization

use crate::cli::ui;
use crate::config::Settings;
use crate::error::{CnapseError, Result};
use clap::{Args, Subcommand};

#[derive(Args, Debug)]
pub struct SyncArgs {
    #[command(subcommand)]
    pub command: SyncCommand,
}

#[derive(Subcommand, Debug)]
pub enum SyncCommand {
    /// Sync with phone
    Phone {
        #[command(subcommand)]
        command: PhoneCommand,
    },

    /// VS Code integration
    Vscode {
        #[command(subcommand)]
        command: VscodeCommand,
    },

    /// Show sync status
    Status,
}

#[derive(Subcommand, Debug)]
pub enum PhoneCommand {
    /// Connect to phone
    Connect {
        /// Phone IP address
        ip: String,

        /// Port (default: 7778)
        #[arg(long, default_value = "7778")]
        port: u16,
    },

    /// Disconnect from phone
    Disconnect,

    /// Show connection status
    Status,
}

#[derive(Subcommand, Debug)]
pub enum VscodeCommand {
    /// Enable VS Code integration
    Enable,

    /// Disable VS Code integration
    Disable,

    /// Show integration status
    Status,
}

pub async fn execute(args: SyncArgs, settings: Option<Settings>) -> Result<()> {
    match args.command {
        SyncCommand::Phone { command } => match command {
            PhoneCommand::Connect { ip, port } => phone_connect(&ip, port, settings).await,
            PhoneCommand::Disconnect => phone_disconnect().await,
            PhoneCommand::Status => phone_status(settings).await,
        },
        SyncCommand::Vscode { command } => match command {
            VscodeCommand::Enable => vscode_enable(settings).await,
            VscodeCommand::Disable => vscode_disable(settings).await,
            VscodeCommand::Status => vscode_status(settings).await,
        },
        SyncCommand::Status => status(settings).await,
    }
}

async fn phone_connect(ip: &str, port: u16, settings: Option<Settings>) -> Result<()> {
    let mut settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    ui::info(&format!("Connecting to phone at {}:{}...", ip, port));

    // Validate IP format
    if ip.parse::<std::net::IpAddr>().is_err() {
        return Err(CnapseError::invalid_input(format!(
            "Invalid IP address: {}",
            ip
        )));
    }

    // TODO: Actually attempt connection
    let spinner = ui::spinner("Establishing connection...");
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    spinner.finish_and_clear();

    // For now, just save the configuration
    settings.sync.enabled = true;
    settings.sync.phone_ip = format!("{}:{}", ip, port);
    settings.save()?;

    ui::success("Phone sync configured!");
    ui::kv("Address", &settings.sync.phone_ip);

    ui::warning("Note: Full phone sync is not yet implemented.");
    ui::info("This feature will allow:");
    ui::list_item("Bidirectional file sync");
    ui::list_item("Command forwarding");
    ui::list_item("Ollama query forwarding");

    Ok(())
}

async fn phone_disconnect() -> Result<()> {
    let mut settings = Settings::load()?;

    settings.sync.enabled = false;
    settings.sync.phone_ip.clear();
    settings.save()?;

    ui::success("Phone sync disabled.");
    Ok(())
}

async fn phone_status(settings: Option<Settings>) -> Result<()> {
    ui::header("Phone Sync Status");

    if let Some(settings) = settings {
        ui::kv("Enabled", &settings.sync.enabled.to_string());

        if !settings.sync.phone_ip.is_empty() {
            ui::kv("Phone address", &settings.sync.phone_ip);
            // TODO: Check actual connection status
            ui::kv("Connection", "not checked (feature in development)");
        } else {
            ui::kv("Phone address", "not configured");
        }
    } else {
        ui::info("Configuration not found.");
    }

    println!();
    Ok(())
}

async fn vscode_enable(settings: Option<Settings>) -> Result<()> {
    let mut settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    settings.sync.vscode_integration = true;
    settings.save()?;

    ui::success("VS Code integration enabled!");

    ui::info("This allows C-napse to:");
    ui::list_item("Detect VS Code workspace");
    ui::list_item("Read open files for context");
    ui::list_item("Send edits back to VS Code");

    ui::warning("Note: Full VS Code integration requires the C-napse extension (coming soon).");

    Ok(())
}

async fn vscode_disable(settings: Option<Settings>) -> Result<()> {
    let mut settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    settings.sync.vscode_integration = false;
    settings.save()?;

    ui::success("VS Code integration disabled.");
    Ok(())
}

async fn vscode_status(settings: Option<Settings>) -> Result<()> {
    ui::header("VS Code Integration Status");

    if let Some(settings) = settings {
        ui::kv("Enabled", &settings.sync.vscode_integration.to_string());

        // Check if VS Code is running
        // TODO: Implement actual VS Code detection
        ui::kv("VS Code running", "not checked (feature in development)");
    } else {
        ui::info("Configuration not found.");
    }

    println!();
    Ok(())
}

async fn status(settings: Option<Settings>) -> Result<()> {
    ui::header("Sync Status");

    if let Some(settings) = settings {
        ui::subheader("Phone Sync");
        ui::kv("Enabled", &settings.sync.enabled.to_string());
        if !settings.sync.phone_ip.is_empty() {
            ui::kv("Address", &settings.sync.phone_ip);
        }

        ui::subheader("VS Code Integration");
        ui::kv("Enabled", &settings.sync.vscode_integration.to_string());
    } else {
        ui::info("Configuration not found. Run 'cnapse init' first.");
    }

    println!();
    Ok(())
}
