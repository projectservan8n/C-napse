//! C-napse: Agentic CLI for your PC
//!
//! Small models. Fast signals.
//!
//! C-napse is a modular, agentic command-line interface that orchestrates
//! a swarm of small, specialized AI agents to control and automate PC tasks.

pub mod agents;
pub mod cli;
pub mod config;
pub mod error;
pub mod inference;
pub mod memory;
pub mod server;
pub mod sync;
pub mod telegram;
pub mod tools;

// Re-export commonly used items
pub use error::{CnapseError, Result};

/// Application version from Cargo.toml
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Application name
pub const APP_NAME: &str = "cnapse";

/// ASCII banner for display
pub const BANNER: &str = r#"
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗║
║  ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝║
║  ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗  ║
║  ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  ║
║  ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗║
║   ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝║
║                                                          ║
║                     agents in sync                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
"#;

/// Compact banner for smaller displays
pub const BANNER_COMPACT: &str = r#"
  ██████╗      ███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
 ██╔════╝      ████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
 ██║     █████╗██╔██╗ ██║███████║██████╔╝███████╗█████╗
 ██║     ╚════╝██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝
 ╚██████╗      ██║ ╚████║██║  ██║██║     ███████║███████╗
  ╚═════╝      ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
"#;
