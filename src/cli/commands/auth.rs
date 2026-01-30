//! cnapse auth command - Manage API credentials

use crate::cli::ui;
use crate::config::Credentials;
use crate::error::{CnapseError, Result};
use clap::{Args, Subcommand};

#[derive(Args, Debug)]
pub struct AuthArgs {
    #[command(subcommand)]
    pub command: AuthCommand,
}

#[derive(Subcommand, Debug)]
pub enum AuthCommand {
    /// Add or update API key
    Add {
        /// Provider name (anthropic, openai, openrouter)
        provider: String,

        /// API key (interactive prompt if not provided)
        #[arg(long)]
        key: Option<String>,
    },

    /// Remove API key
    Remove {
        /// Provider name
        provider: String,
    },

    /// List configured providers
    List,

    /// Test API key validity
    Test {
        /// Provider name
        provider: String,
    },
}

const VALID_PROVIDERS: &[&str] = &["anthropic", "openai", "openrouter"];

pub async fn execute(args: AuthArgs) -> Result<()> {
    match args.command {
        AuthCommand::Add { provider, key } => add(&provider, key).await,
        AuthCommand::Remove { provider } => remove(&provider).await,
        AuthCommand::List => list().await,
        AuthCommand::Test { provider } => test(&provider).await,
    }
}

async fn add(provider: &str, key: Option<String>) -> Result<()> {
    let provider = provider.to_lowercase();

    // Validate provider
    if !VALID_PROVIDERS.contains(&provider.as_str()) {
        return Err(CnapseError::invalid_input(format!(
            "Unknown provider: {}. Valid providers: {}",
            provider,
            VALID_PROVIDERS.join(", ")
        )));
    }

    // Get key interactively if not provided
    let api_key = if let Some(k) = key {
        ui::warning("Passing API keys via command line is not recommended.");
        ui::info("Consider using the interactive prompt instead.");
        k
    } else {
        ui::password(&format!("{} API key", provider))
            .ok_or_else(|| CnapseError::invalid_input("No API key provided"))?
    };

    // Validate key format
    validate_key_format(&provider, &api_key)?;

    // Load, update, and save credentials
    let mut credentials = Credentials::load().unwrap_or_default();
    credentials.set_api_key(&provider, &api_key)?;
    credentials.save()?;

    ui::success(&format!("{} API key saved!", provider));
    ui::kv(
        "Masked key",
        &credentials.get_masked_key(&provider).unwrap_or_default(),
    );

    Ok(())
}

async fn remove(provider: &str) -> Result<()> {
    let provider = provider.to_lowercase();

    if !VALID_PROVIDERS.contains(&provider.as_str()) {
        return Err(CnapseError::invalid_input(format!(
            "Unknown provider: {}",
            provider
        )));
    }

    let mut credentials = Credentials::load()?;

    if !credentials.has_credentials(&provider) {
        ui::warning(&format!("No API key configured for {}", provider));
        return Ok(());
    }

    if ui::confirm(&format!("Remove {} API key?", provider)) {
        credentials.remove_api_key(&provider)?;
        credentials.save()?;
        ui::success(&format!("{} API key removed.", provider));
    } else {
        ui::info("Cancelled.");
    }

    Ok(())
}

async fn list() -> Result<()> {
    let credentials = Credentials::load().unwrap_or_default();

    ui::header("Configured API Providers");

    let providers = credentials.list_configured_providers();

    if providers.is_empty() {
        ui::info("No API keys configured.");
        println!();
        ui::info("Add one with: cnapse auth add <provider>");
        ui::info("Providers: anthropic, openai, openrouter");
    } else {
        for provider in VALID_PROVIDERS {
            let status = if credentials.has_credentials(provider) {
                let masked = credentials.get_masked_key(provider).unwrap_or_default();
                format!("{} {}", ui::SUCCESS, masked)
            } else {
                format!("{} not configured", ui::WARNING)
            };

            ui::kv(provider, &status);
        }
    }

    println!();
    Ok(())
}

async fn test(provider: &str) -> Result<()> {
    let provider = provider.to_lowercase();

    if !VALID_PROVIDERS.contains(&provider.as_str()) {
        return Err(CnapseError::invalid_input(format!(
            "Unknown provider: {}",
            provider
        )));
    }

    let credentials = Credentials::load()?;

    if !credentials.has_credentials(&provider) {
        return Err(CnapseError::auth(format!(
            "No API key configured for {}",
            provider
        )));
    }

    let spinner = ui::spinner(&format!("Testing {} API key...", provider));

    // Perform API test based on provider
    let result = match provider.as_str() {
        "anthropic" => test_anthropic(&credentials).await,
        "openai" => test_openai(&credentials).await,
        "openrouter" => test_openrouter(&credentials).await,
        _ => Err(CnapseError::invalid_input("Unknown provider")),
    };

    spinner.finish_and_clear();

    match result {
        Ok(()) => {
            ui::success(&format!("{} API key is valid!", provider));
        }
        Err(e) => {
            ui::error(&format!("{} API key test failed: {}", provider, e));
            return Err(e);
        }
    }

    Ok(())
}

fn validate_key_format(provider: &str, key: &str) -> Result<()> {
    let valid = match provider {
        "anthropic" => key.starts_with("sk-ant-"),
        "openai" => key.starts_with("sk-"),
        "openrouter" => key.starts_with("sk-or-"),
        _ => true,
    };

    if !valid {
        ui::warning(&format!(
            "API key format doesn't match expected pattern for {}",
            provider
        ));
        if !ui::confirm("Continue anyway?") {
            return Err(CnapseError::invalid_input("Invalid API key format"));
        }
    }

    Ok(())
}

async fn test_anthropic(credentials: &Credentials) -> Result<()> {
    use secrecy::ExposeSecret;

    let api_key = credentials
        .get_api_key("anthropic")
        .ok_or_else(|| CnapseError::auth("No Anthropic API key"))?;

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.expose_secret())
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&serde_json::json!({
            "model": "claude-3-haiku-20240307",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "hi"}]
        }))
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(CnapseError::api(
            "anthropic",
            format!("{}: {}", status, text),
        ))
    }
}

async fn test_openai(credentials: &Credentials) -> Result<()> {
    use secrecy::ExposeSecret;

    let api_key = credentials
        .get_api_key("openai")
        .ok_or_else(|| CnapseError::auth("No OpenAI API key"))?;

    let client = reqwest::Client::new();
    let response = client
        .get("https://api.openai.com/v1/models")
        .header(
            "Authorization",
            format!("Bearer {}", api_key.expose_secret()),
        )
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(CnapseError::api("openai", format!("{}: {}", status, text)))
    }
}

async fn test_openrouter(credentials: &Credentials) -> Result<()> {
    use secrecy::ExposeSecret;

    let api_key = credentials
        .get_api_key("openrouter")
        .ok_or_else(|| CnapseError::auth("No OpenRouter API key"))?;

    let client = reqwest::Client::new();
    let response = client
        .get("https://openrouter.ai/api/v1/auth/key")
        .header(
            "Authorization",
            format!("Bearer {}", api_key.expose_secret()),
        )
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        Err(CnapseError::api(
            "openrouter",
            format!("{}: {}", status, text),
        ))
    }
}
