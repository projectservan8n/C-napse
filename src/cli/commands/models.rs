//! cnapse models command - Manage local AI models

use crate::cli::ui;
use crate::config::{Paths, Settings};
use crate::error::{CnapseError, Result};
use clap::{Args, Subcommand};

#[derive(Args, Debug)]
pub struct ModelsArgs {
    #[command(subcommand)]
    pub command: ModelsCommand,
}

#[derive(Subcommand, Debug)]
pub enum ModelsCommand {
    /// List available models
    List,

    /// Download model from Hugging Face
    Pull {
        /// Model name or HuggingFace repo (e.g., Qwen/Qwen2.5-0.5B-Instruct-GGUF)
        model: String,

        /// Specific file to download (for repos with multiple files)
        #[arg(long)]
        file: Option<String>,
    },

    /// Delete local model
    Remove {
        /// Model filename
        model: String,

        /// Skip confirmation
        #[arg(long)]
        force: bool,
    },

    /// Scan models directory
    Scan,

    /// Assign model to agent role
    Set {
        /// Agent name (router, coder, shell, filer, memory, app)
        agent: String,

        /// Model filename
        model: String,
    },

    /// Show model details
    Info {
        /// Model filename
        model: String,
    },
}

pub async fn execute(args: ModelsArgs, settings: Option<Settings>) -> Result<()> {
    match args.command {
        ModelsCommand::List => list(settings).await,
        ModelsCommand::Pull { model, file } => pull(&model, file.as_deref()).await,
        ModelsCommand::Remove { model, force } => remove(&model, force).await,
        ModelsCommand::Scan => scan().await,
        ModelsCommand::Set { agent, model } => set(&agent, &model, settings).await,
        ModelsCommand::Info { model } => info(&model).await,
    }
}

async fn list(settings: Option<Settings>) -> Result<()> {
    let paths = Paths::new(None)?;
    let models = paths.list_models()?;

    ui::header("Local Models");

    if models.is_empty() {
        ui::info("No models found.");
        ui::info(&format!("Models directory: {}", paths.models.display()));
        println!();
        ui::info("Download models with: cnapse models pull <model>");
        return Ok(());
    }

    // Get agent assignments if we have settings
    let assignments = settings.as_ref().map(|s| {
        vec![
            ("router", &s.local.agents.router),
            ("coder", &s.local.agents.coder),
            ("shell", &s.local.agents.shell),
            ("filer", &s.local.agents.filer),
            ("memory", &s.local.agents.memory),
            ("app", &s.local.agents.app),
        ]
    });

    let headers = ["Model", "Size", "Assigned To"];
    let mut rows: Vec<Vec<String>> = Vec::new();

    for model_path in models {
        let filename = model_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let size = std::fs::metadata(&model_path)
            .map(|m| ui::format_size(m.len()))
            .unwrap_or_else(|_| "?".to_string());

        let assigned = if let Some(ref assigns) = assignments {
            assigns
                .iter()
                .filter(|(_, m)| **m == filename)
                .map(|(a, _)| *a)
                .collect::<Vec<_>>()
                .join(", ")
        } else {
            String::new()
        };

        rows.push(vec![filename, size, assigned]);
    }

    ui::table(&headers, &rows);
    println!();

    Ok(())
}

async fn pull(model: &str, file: Option<&str>) -> Result<()> {
    let paths = Paths::new(None)?;
    paths.ensure_dirs()?;

    // Determine if this is a HuggingFace repo or direct URL
    let (repo, filename) = if model.contains('/') && !model.starts_with("http") {
        // HuggingFace repo format: owner/repo
        let filename = file.unwrap_or_else(|| {
            // Try to guess the GGUF file
            if model.to_lowercase().contains("gguf") {
                // Already specifies GGUF
                model.split('/').next_back().unwrap_or(model)
            } else {
                // Default to Q4_K_M quantization
                ""
            }
        });
        (model.to_string(), filename.to_string())
    } else if model.starts_with("http") {
        // Direct URL
        let filename = model.split('/').next_back().unwrap_or("model.gguf");
        (model.to_string(), filename.to_string())
    } else {
        // Just a filename - assume it's a known model
        return Err(CnapseError::invalid_input(
            "Please provide a HuggingFace repo (e.g., Qwen/Qwen2.5-0.5B-Instruct-GGUF) or URL",
        ));
    };

    ui::info(&format!("Downloading from: {}", repo));

    // Build HuggingFace URL
    let url = if repo.starts_with("http") {
        repo.clone()
    } else {
        // Need to resolve the actual file URL from HuggingFace
        // For now, provide instructions
        ui::warning("Direct HuggingFace download not yet implemented.");
        ui::info("Please download manually:");
        println!();
        ui::info(&format!(
            "1. Go to: https://huggingface.co/{}/tree/main",
            repo
        ));
        ui::info("2. Find the .gguf file you want (e.g., *Q4_K_M.gguf)");
        ui::info(&format!("3. Download to: {}", paths.models.display()));
        println!();
        ui::info("After downloading, run: cnapse models scan");

        return Ok(());
    };

    // Download the file
    let dest_path = paths.models.join(&filename);

    if dest_path.exists() && !ui::confirm(&format!("{} already exists. Overwrite?", filename)) {
        ui::info("Cancelled.");
        return Ok(());
    }

    ui::info(&format!("Downloading to: {}", dest_path.display()));

    let client = reqwest::Client::new();
    let response = client.get(&url).send().await?;

    if !response.status().is_success() {
        return Err(CnapseError::network(format!(
            "Download failed: {}",
            response.status()
        )));
    }

    let total_size = response.content_length().unwrap_or(0);
    let pb = ui::download_bar(total_size, &filename);

    let mut file = std::fs::File::create(&dest_path)?;
    let mut downloaded: u64 = 0;

    use futures::StreamExt;
    use std::io::Write;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;
        pb.set_position(downloaded);
    }

    pb.finish_with_message("Download complete!");

    ui::success(&format!("Model saved: {}", dest_path.display()));

    Ok(())
}

async fn remove(model: &str, force: bool) -> Result<()> {
    let paths = Paths::new(None)?;
    let model_path = paths.model_path(model);

    if !model_path.exists() {
        return Err(CnapseError::not_found(format!(
            "Model not found: {}",
            model
        )));
    }

    if !force {
        let size = std::fs::metadata(&model_path)
            .map(|m| ui::format_size(m.len()))
            .unwrap_or_else(|_| "?".to_string());

        ui::kv("Model", model);
        ui::kv("Size", &size);

        if !ui::confirm("Delete this model?") {
            ui::info("Cancelled.");
            return Ok(());
        }
    }

    std::fs::remove_file(&model_path)?;
    ui::success(&format!("Deleted: {}", model));

    Ok(())
}

async fn scan() -> Result<()> {
    let paths = Paths::new(None)?;

    ui::info(&format!("Scanning: {}", paths.models.display()));

    let models = paths.list_models()?;

    if models.is_empty() {
        ui::info("No models found.");
    } else {
        ui::success(&format!("Found {} model(s):", models.len()));
        for model in models {
            let filename = model.file_name().map(|n| n.to_string_lossy().to_string());
            if let Some(name) = filename {
                let size = std::fs::metadata(&model)
                    .map(|m| ui::format_size(m.len()))
                    .unwrap_or_else(|_| "?".to_string());
                ui::list_item(&format!("{} ({})", name, size));
            }
        }
    }

    Ok(())
}

async fn set(agent: &str, model: &str, settings: Option<Settings>) -> Result<()> {
    let valid_agents = ["router", "coder", "shell", "filer", "memory", "app"];

    if !valid_agents.contains(&agent) {
        return Err(CnapseError::invalid_input(format!(
            "Unknown agent: {}. Valid agents: {}",
            agent,
            valid_agents.join(", ")
        )));
    }

    // Verify model exists
    let paths = Paths::new(None)?;
    let model_path = paths.model_path(model);

    if !model_path.exists() {
        ui::warning(&format!("Model file not found: {}", model_path.display()));
        if !ui::confirm("Set anyway?") {
            return Ok(());
        }
    }

    let mut settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    // Update the agent's model
    match agent {
        "router" => settings.local.agents.router = model.to_string(),
        "coder" => settings.local.agents.coder = model.to_string(),
        "shell" => settings.local.agents.shell = model.to_string(),
        "filer" => settings.local.agents.filer = model.to_string(),
        "memory" => settings.local.agents.memory = model.to_string(),
        "app" => settings.local.agents.app = model.to_string(),
        _ => unreachable!(),
    }

    settings.save()?;

    ui::success(&format!("Agent '{}' now uses model '{}'", agent, model));

    Ok(())
}

async fn info(model: &str) -> Result<()> {
    let paths = Paths::new(None)?;
    let model_path = paths.model_path(model);

    if !model_path.exists() {
        return Err(CnapseError::not_found(format!(
            "Model not found: {}",
            model
        )));
    }

    let metadata = std::fs::metadata(&model_path)?;

    ui::header(&format!("Model: {}", model));

    ui::kv("Path", &model_path.to_string_lossy());
    ui::kv("Size", &ui::format_size(metadata.len()));

    if let Ok(modified) = metadata.modified() {
        let datetime: chrono::DateTime<chrono::Local> = modified.into();
        ui::kv(
            "Modified",
            &datetime.format("%Y-%m-%d %H:%M:%S").to_string(),
        );
    }

    // Try to parse GGUF metadata (basic)
    if model.ends_with(".gguf") {
        ui::subheader("GGUF Info");
        ui::info("(Detailed GGUF parsing not yet implemented)");

        // Estimate based on filename
        if model.contains("Q4_K_M") {
            ui::kv("Quantization", "Q4_K_M (4-bit, medium)");
        } else if model.contains("Q4_K_S") {
            ui::kv("Quantization", "Q4_K_S (4-bit, small)");
        } else if model.contains("Q5_K_M") {
            ui::kv("Quantization", "Q5_K_M (5-bit, medium)");
        } else if model.contains("Q8_0") {
            ui::kv("Quantization", "Q8_0 (8-bit)");
        }
    }

    println!();
    Ok(())
}
