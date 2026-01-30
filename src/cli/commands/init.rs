//! cnapse init command - Initialize configuration

use crate::cli::ui;
use crate::config::{Credentials, Paths, Settings};
use crate::error::Result;
use clap::Args;

#[derive(Args, Debug)]
pub struct InitArgs {
    /// Overwrite existing configuration
    #[arg(long)]
    pub force: bool,

    /// Skip model download prompt
    #[arg(long)]
    pub no_models: bool,

    /// Set default provider
    #[arg(long, value_name = "NAME")]
    #[arg(value_parser = ["local", "anthropic", "openai", "openrouter"])]
    pub provider: Option<String>,

    /// Create minimal config only
    #[arg(long)]
    pub minimal: bool,
}

pub async fn execute(args: InitArgs) -> Result<()> {
    ui::print_banner();
    println!();

    let paths = Paths::new(None)?;

    // Check if already initialized
    if paths.is_initialized() && !args.force {
        ui::warning("C-napse is already initialized!");
        ui::info(&format!("Config location: {:?}", paths.config));
        println!();
        ui::info("Use --force to reinitialize");
        return Ok(());
    }

    ui::info("Initializing C-napse...");
    println!();

    // Step 1: Create directories
    ui::step(1, 5, "Creating directories...");
    paths.ensure_dirs()?;
    ui::kv("Root", &paths.root.to_string_lossy());

    // Step 2: Create config
    ui::step(2, 5, "Creating configuration...");
    let mut settings = Settings::default();

    // Set provider if specified
    if let Some(provider) = &args.provider {
        settings.general.default_provider = provider.clone();
    } else if !args.minimal {
        // Interactive provider selection
        let providers = ["local", "anthropic", "openai", "openrouter"];
        let descriptions = [
            "Local models (no API key needed)",
            "Anthropic Claude API",
            "OpenAI API",
            "OpenRouter (multiple providers)",
        ];

        println!();
        ui::info("Select default inference provider:");
        for (i, (p, d)) in providers.iter().zip(descriptions.iter()).enumerate() {
            println!("  {}. {} - {}", i + 1, p, d);
        }

        if let Some(idx) = ui::select("Provider", &providers) {
            settings.general.default_provider = providers[idx].to_string();
        }
    }

    settings.save()?;
    ui::kv("Config", &paths.config.to_string_lossy());

    // Step 3: Create credentials file
    ui::step(3, 5, "Creating credentials file...");
    let credentials = Credentials::default();
    credentials.save()?;
    ui::kv("Credentials", &paths.credentials.to_string_lossy());

    // Step 4: Prompt for API keys (if not minimal and not local-only)
    if !args.minimal && settings.general.default_provider != "local" {
        ui::step(4, 5, "API key configuration...");
        println!();

        let provider = &settings.general.default_provider;
        ui::info(&format!("You selected '{}' as default provider.", provider));

        if ui::confirm(&format!(
            "Would you like to add your {} API key now?",
            provider
        )) {
            if let Some(key) = ui::password(&format!("{} API key", provider)) {
                let mut creds = Credentials::load()?;
                creds.set_api_key(provider, &key)?;
                creds.save()?;
                ui::success(&format!("{} API key saved!", provider));
            }
        } else {
            ui::info(&format!(
                "You can add it later with: cnapse auth add {}",
                provider
            ));
        }
    } else {
        ui::step(4, 5, "Skipping API key configuration (local mode)");
    }

    // Step 5: Model download prompt
    if !args.no_models && settings.general.default_provider == "local" {
        ui::step(5, 5, "Model setup...");
        println!();
        ui::info("Local inference requires AI models (~2GB total for starter set).");
        ui::info("Models:");
        ui::list_item("qwen2.5-0.5b-instruct.Q4_K_M.gguf (~300MB) - Router, Shell, Filer, Memory");
        ui::list_item("qwen2.5-coder-1.5b-instruct.Q4_K_M.gguf (~900MB) - Coder, App");
        println!();

        if ui::confirm("Download starter models now?") {
            ui::info("Run 'cnapse models pull' to download models.");
            ui::info("For now, starting without models (will use cloud fallback if configured).");
        } else {
            ui::info("You can download models later with: cnapse models pull");
        }
    } else {
        ui::step(5, 5, "Model download skipped");
    }

    // Done!
    println!();
    ui::divider();
    ui::success("C-napse initialized successfully!");
    println!();
    ui::header("Next steps:");
    ui::list_item("cnapse                    # Start interactive REPL");
    ui::list_item("cnapse \"your query\"       # Run a single command");
    ui::list_item("cnapse serve              # Start web server");
    ui::list_item("cnapse --help             # Show all options");
    println!();

    if settings.general.default_provider == "local" {
        ui::warning("Note: Local models not yet downloaded. Commands will fail until:");
        ui::list_item("Models are downloaded (cnapse models pull)");
        ui::list_item("Or a cloud provider API key is configured (cnapse auth add)");
        println!();
    }

    Ok(())
}
