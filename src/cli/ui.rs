//! UI utilities for CLI output (colors, spinners, etc.)

use console::{style, Emoji, Term};
use indicatif::{ProgressBar, ProgressStyle};

// Emojis for different message types
pub static SUCCESS: Emoji<'_, '_> = Emoji("✓ ", "√ ");
pub static ERROR: Emoji<'_, '_> = Emoji("✗ ", "X ");
pub static WARNING: Emoji<'_, '_> = Emoji("⚠ ", "! ");
pub static INFO: Emoji<'_, '_> = Emoji("ℹ ", "i ");
pub static ARROW: Emoji<'_, '_> = Emoji("→ ", "-> ");
pub static THINKING: Emoji<'_, '_> = Emoji("🤔 ", "? ");
pub static ROBOT: Emoji<'_, '_> = Emoji("🤖 ", "[AI] ");
pub static FOLDER: Emoji<'_, '_> = Emoji("📁 ", "[D] ");
pub static FILE: Emoji<'_, '_> = Emoji("📄 ", "[F] ");
pub static KEY: Emoji<'_, '_> = Emoji("🔑 ", "[K] ");
pub static GEAR: Emoji<'_, '_> = Emoji("⚙️ ", "[*] ");
pub static DOWNLOAD: Emoji<'_, '_> = Emoji("📥 ", "[v] ");
pub static SERVER: Emoji<'_, '_> = Emoji("🌐 ", "[S] ");

/// Print the C-napse banner
pub fn print_banner() {
    println!(
        "{}",
        style(crate::BANNER_COMPACT).cyan()
    );
}

/// Print a success message
pub fn success(msg: &str) {
    println!("{} {}", style(SUCCESS).green(), style(msg).green());
}

/// Print an error message
pub fn error(msg: &str) {
    eprintln!("{} {}", style(ERROR).red(), style(msg).red());
}

/// Print a warning message
pub fn warning(msg: &str) {
    println!("{} {}", style(WARNING).yellow(), style(msg).yellow());
}

/// Print an info message
pub fn info(msg: &str) {
    println!("{} {}", style(INFO).blue(), msg);
}

/// Print a step message (for multi-step operations)
pub fn step(num: usize, total: usize, msg: &str) {
    println!(
        "{} {} {}",
        style(format!("[{}/{}]", num, total)).dim(),
        ARROW,
        msg
    );
}

/// Print a key-value pair
pub fn kv(key: &str, value: &str) {
    println!("  {}: {}", style(key).bold(), value);
}

/// Print a list item
pub fn list_item(item: &str) {
    println!("  {} {}", style("•").dim(), item);
}

/// Print a header
pub fn header(title: &str) {
    println!();
    println!("{}", style(title).bold().underlined());
    println!();
}

/// Print a subheader
pub fn subheader(title: &str) {
    println!();
    println!("{}", style(title).bold());
}

/// Print agent output
pub fn agent_output(agent: &str, content: &str) {
    println!();
    println!("{} {} {}", ROBOT, style(format!("[{}]", agent)).cyan().bold(), style("─".repeat(40)).dim());
    println!("{}", content);
    println!("{}", style("─".repeat(60)).dim());
}

/// Print user prompt indicator
pub fn prompt() -> String {
    format!("{} ", style("cnapse>").green().bold())
}

/// Create a spinner for long operations
pub fn spinner(msg: &str) -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .tick_chars("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏")
            .template("{spinner:.cyan} {msg}")
            .expect("Invalid spinner template"),
    );
    pb.set_message(msg.to_string());
    pb.enable_steady_tick(std::time::Duration::from_millis(80));
    pb
}

/// Create a progress bar for downloads
pub fn download_bar(total: u64, msg: &str) -> ProgressBar {
    let pb = ProgressBar::new(total);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{msg}\n{spinner:.green} [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
            .expect("Invalid progress bar template")
            .progress_chars("█▓░"),
    );
    pb.set_message(msg.to_string());
    pb
}

/// Confirm action with user
pub fn confirm(msg: &str) -> bool {
    dialoguer::Confirm::new()
        .with_prompt(msg)
        .default(false)
        .interact()
        .unwrap_or(false)
}

/// Prompt for text input
pub fn input(prompt: &str) -> Option<String> {
    dialoguer::Input::<String>::new()
        .with_prompt(prompt)
        .allow_empty(true)
        .interact()
        .ok()
        .filter(|s| !s.is_empty())
}

/// Prompt for password input (hidden)
pub fn password(prompt: &str) -> Option<String> {
    dialoguer::Password::new()
        .with_prompt(prompt)
        .allow_empty_password(false)
        .interact()
        .ok()
}

/// Select from a list of options
pub fn select<T: ToString>(prompt: &str, options: &[T]) -> Option<usize> {
    dialoguer::Select::new()
        .with_prompt(prompt)
        .items(options)
        .default(0)
        .interact()
        .ok()
}

/// Multi-select from a list of options
pub fn multiselect<T: ToString>(prompt: &str, options: &[T]) -> Vec<usize> {
    dialoguer::MultiSelect::new()
        .with_prompt(prompt)
        .items(options)
        .interact()
        .unwrap_or_default()
}

/// Clear the terminal
pub fn clear() {
    let term = Term::stdout();
    let _ = term.clear_screen();
}

/// Print a horizontal divider
pub fn divider() {
    println!("{}", style("─".repeat(60)).dim());
}

/// Print code block
pub fn code_block(language: &str, code: &str) {
    println!("{}", style(format!("```{}", language)).dim());
    println!("{}", code);
    println!("{}", style("```").dim());
}

/// Print a table
pub fn table(headers: &[&str], rows: &[Vec<String>]) {
    // Calculate column widths
    let mut widths: Vec<usize> = headers.iter().map(|h| h.len()).collect();
    for row in rows {
        for (i, cell) in row.iter().enumerate() {
            if i < widths.len() {
                widths[i] = widths[i].max(cell.len());
            }
        }
    }

    // Print header
    let header_line: String = headers
        .iter()
        .zip(&widths)
        .map(|(h, w)| format!("{:width$}", h, width = *w))
        .collect::<Vec<_>>()
        .join(" │ ");
    println!("{}", style(header_line).bold());

    // Print separator
    let sep: String = widths
        .iter()
        .map(|w| "─".repeat(*w))
        .collect::<Vec<_>>()
        .join("─┼─");
    println!("{}", style(sep).dim());

    // Print rows
    for row in rows {
        let line: String = row
            .iter()
            .zip(&widths)
            .map(|(c, w)| format!("{:width$}", c, width = *w))
            .collect::<Vec<_>>()
            .join(" │ ");
        println!("{}", line);
    }
}

/// Format file size for display
pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Format duration for display
pub fn format_duration(secs: u64) -> String {
    if secs >= 3600 {
        format!("{}h {}m", secs / 3600, (secs % 3600) / 60)
    } else if secs >= 60 {
        format!("{}m {}s", secs / 60, secs % 60)
    } else {
        format!("{}s", secs)
    }
}
