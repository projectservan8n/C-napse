//! CLI module for C-napse

pub mod commands;
pub mod ui;

use clap::{Parser, Subcommand};

/// C-napse: Agentic CLI for your PC - small models, fast signals
#[derive(Parser, Debug)]
#[command(name = "cnapse")]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
pub struct Cli {
    /// Direct query (starts REPL if omitted)
    #[arg(trailing_var_arg = true)]
    pub query: Option<String>,

    /// Override inference provider
    #[arg(short, long, value_name = "PROVIDER")]
    #[arg(value_parser = ["local", "anthropic", "openai", "openrouter"])]
    pub provider: Option<String>,

    /// Force specific agent
    #[arg(short, long, value_name = "AGENT")]
    #[arg(value_parser = ["router", "coder", "shell", "filer", "memory", "app"])]
    pub agent: Option<String>,

    /// Increase verbosity (-v, -vv, -vvv)
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub verbose: u8,

    /// Suppress non-essential output
    #[arg(short, long)]
    pub quiet: bool,

    /// Output format
    #[arg(short, long, value_name = "FORMAT")]
    #[arg(value_parser = ["text", "json", "markdown"])]
    pub output: Option<String>,

    /// Disable context memory for this session
    #[arg(long)]
    pub no_memory: bool,

    /// Use named config profile
    #[arg(long, value_name = "NAME")]
    pub profile: Option<String>,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Initialize C-napse configuration
    Init(commands::init::InitArgs),

    /// View and modify settings
    Config(commands::config::ConfigArgs),

    /// Manage API credentials
    Auth(commands::auth::AuthArgs),

    /// Manage local AI models
    Models(commands::models::ModelsArgs),

    /// Execute a single command
    Run(commands::run::RunArgs),

    /// Start the web server and API
    Serve(commands::serve::ServeArgs),

    /// Manage Telegram bot
    Telegram(commands::telegram::TelegramArgs),

    /// Create and manage apps
    App(commands::app::AppArgs),

    /// Phone and VS Code sync
    Sync(commands::sync::SyncArgs),
}
