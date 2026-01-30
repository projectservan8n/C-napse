//! Interactive REPL mode for C-napse

use crate::cli::ui;
use crate::config::Settings;
use crate::error::{CnapseError, Result};
use console::{style, Term};
use std::io::{self, Write};

pub async fn execute(
    provider: Option<&str>,
    output_format: Option<&str>,
    use_memory: bool,
    settings: Option<Settings>,
) -> Result<()> {
    let settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    // Print welcome banner
    ui::print_banner();
    println!();
    println!(
        "  {} {}",
        style("C-napse").cyan().bold(),
        style(format!("v{}", crate::VERSION)).dim()
    );
    println!("  {}", style("agents in sync").dim());
    println!();

    // Show current config
    let active_provider = provider.unwrap_or(&settings.general.default_provider);
    ui::info(&format!("Provider: {}", active_provider));
    ui::info(&format!(
        "Memory: {}",
        if use_memory { "enabled" } else { "disabled" }
    ));
    println!();

    ui::info("Type 'help' for commands, 'exit' to quit.");
    ui::divider();

    // REPL loop
    let term = Term::stdout();
    let mut history: Vec<String> = Vec::new();

    loop {
        // Print prompt
        print!("{}", ui::prompt());
        io::stdout().flush()?;

        // Read input
        let input = match read_line(&term) {
            Ok(line) => line.trim().to_string(),
            Err(_) => break,
        };

        // Skip empty input
        if input.is_empty() {
            continue;
        }

        // Add to history
        history.push(input.clone());

        // Handle special commands
        match input.to_lowercase().as_str() {
            "exit" | "quit" | "q" => {
                ui::info("Goodbye!");
                break;
            }
            "help" | "?" => {
                print_help();
                continue;
            }
            "clear" | "cls" => {
                ui::clear();
                ui::print_banner();
                continue;
            }
            "history" => {
                print_history(&history);
                continue;
            }
            "status" => {
                print_status(&settings).await;
                continue;
            }
            "config" => {
                ui::info(&format!("Provider: {}", active_provider));
                ui::info(&format!(
                    "Memory: {}",
                    if use_memory { "enabled" } else { "disabled" }
                ));
                continue;
            }
            _ => {}
        }

        // Check for command prefix
        if input.starts_with('/') {
            handle_slash_command(&input, &settings).await?;
            continue;
        }

        // Execute the query
        match super::run::execute_query(
            &input,
            Some(active_provider),
            None,
            output_format,
            use_memory,
            Some(settings.clone()),
        )
        .await
        {
            Ok(()) => {}
            Err(e) => {
                ui::error(&format!("{}", e));
            }
        }

        println!();
    }

    Ok(())
}

fn read_line(term: &Term) -> Result<String> {
    term.read_line()
        .map_err(|e| CnapseError::tool(format!("Failed to read input: {}", e)))
}

fn print_help() {
    ui::header("C-napse Commands");

    ui::subheader("General");
    ui::kv("help, ?", "Show this help message");
    ui::kv("exit, quit, q", "Exit C-napse");
    ui::kv("clear, cls", "Clear the screen");
    ui::kv("history", "Show command history");
    ui::kv("status", "Show system status");
    ui::kv("config", "Show current configuration");

    ui::subheader("Slash Commands");
    ui::kv("/shell <cmd>", "Force shell agent");
    ui::kv("/code <query>", "Force coder agent");
    ui::kv("/file <query>", "Force filer agent");
    ui::kv("/memory <query>", "Force memory agent");
    ui::kv("/app <query>", "Force app agent");
    ui::kv("/provider <name>", "Switch provider");

    ui::subheader("Examples");
    println!("  {}", style("list all python files").cyan());
    println!("  {}", style("write a function to sort numbers").cyan());
    println!("  {}", style("what's using port 8080").cyan());
    println!("  {}", style("/code debug this error: ...").cyan());

    println!();
}

fn print_history(history: &[String]) {
    ui::header("Command History");

    if history.is_empty() {
        ui::info("No history yet.");
        return;
    }

    for (i, cmd) in history.iter().enumerate() {
        println!("  {} {}", style(format!("{:3}.", i + 1)).dim(), cmd);
    }
    println!();
}

async fn print_status(settings: &Settings) {
    ui::header("System Status");

    // System info
    let sys = sysinfo::System::new_all();

    ui::subheader("System");
    ui::kv("OS", std::env::consts::OS);
    ui::kv("Arch", std::env::consts::ARCH);
    ui::kv(
        "Memory",
        &format!(
            "{} / {}",
            ui::format_size(sys.used_memory()),
            ui::format_size(sys.total_memory())
        ),
    );
    ui::kv("CPUs", &sys.cpus().len().to_string());

    // C-napse info
    ui::subheader("C-napse");
    ui::kv("Version", crate::VERSION);
    ui::kv("Provider", &settings.general.default_provider);

    // Check models
    let paths = crate::config::Paths::new(None).unwrap();
    let models = paths.list_models().unwrap_or_default();
    ui::kv("Local models", &models.len().to_string());

    // Check credentials
    let creds = crate::config::Credentials::load().unwrap_or_default();
    let providers = creds.list_configured_providers();
    ui::kv("API providers", &providers.len().to_string());

    println!();
}

async fn handle_slash_command(input: &str, settings: &Settings) -> Result<()> {
    let parts: Vec<&str> = input.splitn(2, ' ').collect();
    let command = parts[0].trim_start_matches('/');
    let args = parts.get(1).copied().unwrap_or("");

    match command {
        "shell" | "sh" => {
            if args.is_empty() {
                ui::error("Usage: /shell <command>");
                return Ok(());
            }
            super::run::execute_query(
                args,
                Some(&settings.general.default_provider),
                Some("shell"),
                None,
                true,
                Some(settings.clone()),
            )
            .await?;
        }
        "code" | "coder" => {
            if args.is_empty() {
                ui::error("Usage: /code <query>");
                return Ok(());
            }
            super::run::execute_query(
                args,
                Some(&settings.general.default_provider),
                Some("coder"),
                None,
                true,
                Some(settings.clone()),
            )
            .await?;
        }
        "file" | "filer" => {
            if args.is_empty() {
                ui::error("Usage: /file <query>");
                return Ok(());
            }
            super::run::execute_query(
                args,
                Some(&settings.general.default_provider),
                Some("filer"),
                None,
                true,
                Some(settings.clone()),
            )
            .await?;
        }
        "memory" | "mem" => {
            if args.is_empty() {
                ui::error("Usage: /memory <query>");
                return Ok(());
            }
            super::run::execute_query(
                args,
                Some(&settings.general.default_provider),
                Some("memory"),
                None,
                true,
                Some(settings.clone()),
            )
            .await?;
        }
        "app" => {
            if args.is_empty() {
                ui::error("Usage: /app <query>");
                return Ok(());
            }
            super::run::execute_query(
                args,
                Some(&settings.general.default_provider),
                Some("app"),
                None,
                true,
                Some(settings.clone()),
            )
            .await?;
        }
        "provider" | "p" => {
            if args.is_empty() {
                ui::info(&format!(
                    "Current provider: {}",
                    settings.general.default_provider
                ));
                ui::info("Available: local, anthropic, openai, openrouter");
            } else {
                ui::info(&format!("Switched to provider: {}", args));
                ui::warning("Note: This only affects the current session.");
            }
        }
        _ => {
            ui::error(&format!("Unknown command: /{}", command));
            ui::info("Type 'help' for available commands.");
        }
    }

    Ok(())
}
