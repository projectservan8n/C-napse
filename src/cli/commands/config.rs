//! cnapse config command - View and modify configuration

use crate::cli::ui;
use crate::config::{Paths, Settings};
use crate::error::{CnapseError, Result};
use clap::{Args, Subcommand};

#[derive(Args, Debug)]
pub struct ConfigArgs {
    #[command(subcommand)]
    pub command: ConfigCommand,
}

#[derive(Subcommand, Debug)]
pub enum ConfigCommand {
    /// Display current configuration
    Show {
        /// Include masked API keys
        #[arg(long)]
        secrets: bool,
    },

    /// Set a configuration value
    Set {
        /// Config path (e.g., local.threads)
        key: String,
        /// Value to set
        value: String,
    },

    /// Get a configuration value
    Get {
        /// Config path (e.g., local.threads)
        key: String,
    },

    /// Open config in $EDITOR
    Edit,

    /// Reset to defaults
    Reset {
        /// Skip confirmation
        #[arg(long)]
        force: bool,
    },

    /// Print config file path
    Path,
}

pub async fn execute(args: ConfigArgs, settings: Option<Settings>) -> Result<()> {
    match args.command {
        ConfigCommand::Show { secrets } => show(settings, secrets).await,
        ConfigCommand::Set { key, value } => set(settings, &key, &value).await,
        ConfigCommand::Get { key } => get(settings, &key).await,
        ConfigCommand::Edit => edit().await,
        ConfigCommand::Reset { force } => reset(force).await,
        ConfigCommand::Path => path().await,
    }
}

async fn show(settings: Option<Settings>, _secrets: bool) -> Result<()> {
    let settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    ui::header("C-napse Configuration");

    ui::subheader("General");
    ui::kv("Default provider", &settings.general.default_provider);
    ui::kv("Log level", &settings.general.log_level);
    ui::kv("Telemetry", &settings.general.telemetry.to_string());

    ui::subheader("Local Inference");
    ui::kv("Models directory", &settings.local.models_dir);
    ui::kv("Threads", &settings.local.threads.to_string());
    ui::kv("GPU layers", &settings.local.gpu_layers.to_string());
    ui::kv("Batch size", &settings.local.batch_size.to_string());
    ui::kv("Context size", &settings.local.context_size.to_string());

    ui::subheader("Agent Models");
    ui::kv("Router", &settings.local.agents.router);
    ui::kv("Coder", &settings.local.agents.coder);
    ui::kv("Shell", &settings.local.agents.shell);
    ui::kv("Filer", &settings.local.agents.filer);
    ui::kv("Memory", &settings.local.agents.memory);
    ui::kv("App", &settings.local.agents.app);

    ui::subheader("Cloud Providers");
    ui::kv("Anthropic model", &settings.anthropic.model);
    ui::kv("OpenAI model", &settings.openai.model);
    ui::kv("OpenRouter model", &settings.openrouter.model);

    ui::subheader("Memory");
    ui::kv("Hot turns", &settings.memory.hot_turns.to_string());
    ui::kv("Warm chunks", &settings.memory.warm_chunks.to_string());
    ui::kv("Cold storage", &settings.memory.cold_storage.to_string());

    ui::subheader("Server");
    ui::kv("Host", &settings.server.host);
    ui::kv("Port", &settings.server.port.to_string());
    ui::kv("Auth enabled", &settings.server.enable_auth.to_string());

    ui::subheader("Telegram");
    ui::kv("Enabled", &settings.telegram.enabled.to_string());
    ui::kv(
        "Allowed users",
        &format!("{} configured", settings.telegram.allowed_users.len()),
    );

    println!();
    Ok(())
}

async fn set(settings: Option<Settings>, key: &str, value: &str) -> Result<()> {
    let mut settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    // Validate the key exists
    if settings.get(key).is_none() {
        return Err(CnapseError::config(format!("Unknown config key: {}", key)));
    }

    let old_value = settings.get(key).unwrap_or_default();
    settings.set(key, value)?;
    settings.save()?;

    ui::success(&format!("Updated {} = {} (was: {})", key, value, old_value));
    Ok(())
}

async fn get(settings: Option<Settings>, key: &str) -> Result<()> {
    let settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    match settings.get(key) {
        Some(value) => {
            println!("{}", value);
            Ok(())
        }
        None => Err(CnapseError::config(format!("Unknown config key: {}", key))),
    }
}

async fn edit() -> Result<()> {
    let paths = Paths::new(None)?;

    if !paths.config.exists() {
        return Err(CnapseError::config(
            "Configuration not found. Run 'cnapse init' first.",
        ));
    }

    // Get editor from environment
    let editor = std::env::var("EDITOR")
        .or_else(|_| std::env::var("VISUAL"))
        .unwrap_or_else(|_| {
            if cfg!(windows) {
                "notepad".to_string()
            } else {
                "nano".to_string()
            }
        });

    ui::info(&format!("Opening config in {}...", editor));

    let status = std::process::Command::new(&editor)
        .arg(&paths.config)
        .status()
        .map_err(|e| CnapseError::tool(format!("Failed to open editor: {}", e)))?;

    if status.success() {
        ui::success("Configuration updated.");
    } else {
        ui::warning("Editor exited with non-zero status.");
    }

    Ok(())
}

async fn reset(force: bool) -> Result<()> {
    if !force {
        ui::warning("This will reset ALL configuration to defaults!");
        if !ui::confirm("Are you sure?") {
            ui::info("Cancelled.");
            return Ok(());
        }
    }

    let settings = Settings::default();
    settings.save()?;

    ui::success("Configuration reset to defaults.");
    Ok(())
}

async fn path() -> Result<()> {
    let paths = Paths::new(None)?;
    println!("{}", paths.config.display());
    Ok(())
}
