//! cnapse serve command - Start the web server and API

use crate::cli::ui;
use crate::config::Settings;
use crate::error::{CnapseError, Result};
use clap::Args;

#[derive(Args, Debug)]
pub struct ServeArgs {
    /// Bind address
    #[arg(long, default_value = "0.0.0.0")]
    pub host: String,

    /// Port number
    #[arg(long, default_value = "7777")]
    pub port: u16,

    /// API only, no web interface
    #[arg(long)]
    pub no_web: bool,

    /// Disable authentication
    #[arg(long)]
    pub no_auth: bool,

    /// Enable HTTPS
    #[arg(long)]
    pub ssl: bool,
}

pub async fn execute(args: ServeArgs, settings: Option<Settings>) -> Result<()> {
    let settings = settings
        .ok_or_else(|| CnapseError::config("Configuration not found. Run 'cnapse init' first."))?;

    // Override settings with command line args
    let host = args.host;
    let port = args.port;

    ui::print_banner();
    println!();

    // Warning for no-auth mode
    if args.no_auth {
        ui::warning("⚠️  Authentication is DISABLED!");
        ui::warning("⚠️  Anyone on the network can access C-napse!");
        println!();

        if host == "0.0.0.0" && !ui::confirm("Are you sure you want to continue?") {
            ui::info("Cancelled.");
            return Ok(());
        }
    }

    // Show server info
    ui::header("Starting C-napse Server");

    let protocol = if args.ssl { "https" } else { "http" };
    let base_url = format!("{}://{}:{}", protocol, host, port);

    ui::kv("REST API", &format!("{}/api/v1", base_url));
    ui::kv("WebSocket", &format!("ws://{}:{}/ws", host, port));

    if !args.no_web {
        ui::kv("Web Portal", &base_url);
        ui::kv("App Launcher", &format!("{}/apps", base_url));
    }

    ui::kv("Auth", if args.no_auth { "disabled" } else { "enabled" });
    println!();

    // Get local IP for network access
    if let Ok(ip) = local_ip_address::local_ip() {
        ui::info(&format!("Network access: {}://{}:{}", protocol, ip, port));
    }

    ui::divider();
    ui::info("Press Ctrl+C to stop the server");
    println!();

    // Start the server
    crate::server::start_server(host, port, args.no_web, args.no_auth, settings).await?;

    Ok(())
}
