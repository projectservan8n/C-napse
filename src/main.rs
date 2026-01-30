//! C-napse CLI entry point

use clap::Parser;
use cnapse::cli::{Cli, Commands};
use cnapse::config::Settings;
use console::style;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Parse CLI arguments
    let cli = Cli::parse();

    // Initialize logging
    let log_level = match cli.verbose {
        0 => "warn",
        1 => "info",
        2 => "debug",
        _ => "trace",
    };

    let filter = if cli.quiet {
        "error"
    } else {
        log_level
    };

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            format!("cnapse={filter},tower_http={filter}").into()
        }))
        .with(tracing_subscriber::fmt::layer().with_target(false))
        .init();

    // Load configuration (if it exists)
    let settings = Settings::load().ok();

    // Handle commands
    match cli.command {
        Some(Commands::Init(args)) => {
            cnapse::cli::commands::init::execute(args).await?;
        }
        Some(Commands::Config(args)) => {
            cnapse::cli::commands::config::execute(args, settings).await?;
        }
        Some(Commands::Auth(args)) => {
            cnapse::cli::commands::auth::execute(args).await?;
        }
        Some(Commands::Models(args)) => {
            cnapse::cli::commands::models::execute(args, settings).await?;
        }
        Some(Commands::Run(args)) => {
            cnapse::cli::commands::run::execute(args, settings).await?;
        }
        Some(Commands::Serve(args)) => {
            cnapse::cli::commands::serve::execute(args, settings).await?;
        }
        Some(Commands::Telegram(args)) => {
            cnapse::cli::commands::telegram::execute(args, settings).await?;
        }
        Some(Commands::App(args)) => {
            cnapse::cli::commands::app::execute(args, settings).await?;
        }
        Some(Commands::Sync(args)) => {
            cnapse::cli::commands::sync::execute(args, settings).await?;
        }
        None => {
            // No command provided - check for direct query or start REPL
            if let Some(query) = cli.query {
                // Direct query mode
                cnapse::cli::commands::run::execute_query(
                    &query,
                    cli.provider.as_deref(),
                    cli.agent.as_deref(),
                    cli.output.as_deref(),
                    !cli.no_memory,
                    settings,
                )
                .await?;
            } else {
                // Interactive REPL mode
                cnapse::cli::commands::repl::execute(
                    cli.provider.as_deref(),
                    cli.output.as_deref(),
                    !cli.no_memory,
                    settings,
                )
                .await?;
            }
        }
    }

    Ok(())
}
