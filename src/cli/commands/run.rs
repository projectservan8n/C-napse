//! cnapse run command - Execute a single command

use crate::cli::ui;
use crate::config::Settings;
use crate::error::{CnapseError, Result};
use clap::Args;

#[derive(Args, Debug)]
pub struct RunArgs {
    /// Query to execute
    pub query: String,

    /// Override inference provider
    #[arg(short, long)]
    pub provider: Option<String>,

    /// Force specific agent
    #[arg(short, long)]
    pub agent: Option<String>,

    /// Output format
    #[arg(short, long)]
    #[arg(value_parser = ["text", "json", "markdown"])]
    pub output: Option<String>,

    /// Disable memory for this execution
    #[arg(long)]
    pub no_memory: bool,
}

pub async fn execute(args: RunArgs, settings: Option<Settings>) -> Result<()> {
    execute_query(
        &args.query,
        args.provider.as_deref(),
        args.agent.as_deref(),
        args.output.as_deref(),
        !args.no_memory,
        settings,
    )
    .await
}

pub async fn execute_query(
    query: &str,
    provider: Option<&str>,
    agent: Option<&str>,
    output_format: Option<&str>,
    use_memory: bool,
    settings: Option<Settings>,
) -> Result<()> {
    let settings = settings.ok_or_else(|| {
        CnapseError::config("Configuration not found. Run 'cnapse init' first.")
    })?;

    // Determine provider to use
    let provider = provider.unwrap_or(&settings.general.default_provider);

    // Show what we're doing
    if output_format != Some("json") {
        ui::info(&format!("Provider: {}", provider));
        if let Some(a) = agent {
            ui::info(&format!("Agent: {}", a));
        }
    }

    let spinner = ui::spinner("Processing...");

    // Route the query to appropriate agent
    let (selected_agent, response) = process_query(query, provider, agent, &settings).await?;

    spinner.finish_and_clear();

    // Output the response
    match output_format {
        Some("json") => {
            let output = serde_json::json!({
                "query": query,
                "agent": selected_agent,
                "provider": provider,
                "response": response,
            });
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
        Some("markdown") => {
            println!("## Query\n\n{}\n", query);
            println!("## Response ({})\n\n{}", selected_agent, response);
        }
        _ => {
            ui::agent_output(&selected_agent, &response);
        }
    }

    Ok(())
}

async fn process_query(
    query: &str,
    provider: &str,
    forced_agent: Option<&str>,
    settings: &Settings,
) -> Result<(String, String)> {
    // If agent is forced, use it directly
    let agent = if let Some(a) = forced_agent {
        a.to_string()
    } else {
        // Route the query to determine the best agent
        route_query(query, provider, settings).await?
    };

    // Execute with the selected agent
    let response = execute_with_agent(query, &agent, provider, settings).await?;

    Ok((agent, response))
}

async fn route_query(query: &str, provider: &str, settings: &Settings) -> Result<String> {
    // Simple keyword-based routing for now
    // In full implementation, this would use the router agent
    let query_lower = query.to_lowercase();

    let agent = if query_lower.contains("code")
        || query_lower.contains("write")
        || query_lower.contains("function")
        || query_lower.contains("script")
        || query_lower.contains("debug")
        || query_lower.contains("fix")
    {
        "coder"
    } else if query_lower.contains("file")
        || query_lower.contains("folder")
        || query_lower.contains("directory")
        || query_lower.contains("find")
        || query_lower.contains("search")
        || query_lower.contains("list")
    {
        "filer"
    } else if query_lower.contains("run")
        || query_lower.contains("execute")
        || query_lower.contains("command")
        || query_lower.contains("install")
        || query_lower.contains("process")
        || query_lower.contains("port")
    {
        "shell"
    } else if query_lower.contains("remember")
        || query_lower.contains("recall")
        || query_lower.contains("history")
        || query_lower.contains("yesterday")
        || query_lower.contains("earlier")
    {
        "memory"
    } else if query_lower.contains("app")
        || query_lower.contains("webapp")
        || query_lower.contains("website")
        || query_lower.contains("launcher")
    {
        "app"
    } else {
        // Default to shell for general queries
        "shell"
    };

    Ok(agent.to_string())
}

async fn execute_with_agent(
    query: &str,
    agent: &str,
    provider: &str,
    settings: &Settings,
) -> Result<String> {
    // For now, return a placeholder response
    // Full implementation would use the actual agent and inference backend

    match provider {
        "local" => {
            // Check if model is available
            let model = match agent {
                "router" => &settings.local.agents.router,
                "coder" => &settings.local.agents.coder,
                "shell" => &settings.local.agents.shell,
                "filer" => &settings.local.agents.filer,
                "memory" => &settings.local.agents.memory,
                "app" => &settings.local.agents.app,
                _ => return Err(CnapseError::agent(format!("Unknown agent: {}", agent))),
            };

            // Check if model file exists
            let paths = crate::config::Paths::new(None)?;
            let model_path = paths.model_path(model);

            if !model_path.exists() {
                return Err(CnapseError::model(format!(
                    "Model not found: {}. Download with: cnapse models pull <model>",
                    model
                )));
            }

            // TODO: Implement actual local inference
            Ok(format!(
                "[Local inference not yet implemented]\n\nQuery: {}\nAgent: {}\nModel: {}",
                query, agent, model
            ))
        }
        "anthropic" | "openai" | "openrouter" => {
            // Check for API key
            let credentials = crate::config::Credentials::load()?;
            if !credentials.has_credentials(provider) {
                return Err(CnapseError::auth(format!(
                    "No API key for {}. Add with: cnapse auth add {}",
                    provider, provider
                )));
            }

            // TODO: Implement actual API call
            Ok(format!(
                "[{} API call not yet implemented]\n\nQuery: {}\nAgent: {}",
                provider, query, agent
            ))
        }
        _ => Err(CnapseError::invalid_input(format!(
            "Unknown provider: {}",
            provider
        ))),
    }
}
