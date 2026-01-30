//! cnapse app command - Create and manage apps for the launcher

use crate::cli::ui;
use crate::config::{Paths, Settings};
use crate::error::{CnapseError, Result};
use clap::{Args, Subcommand};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Args, Debug)]
pub struct AppArgs {
    #[command(subcommand)]
    pub command: AppCommand,
}

#[derive(Subcommand, Debug)]
pub enum AppCommand {
    /// Create a new app
    Create {
        /// App name
        name: String,

        /// Framework to use
        #[arg(long, default_value = "vue")]
        #[arg(value_parser = ["vue", "react", "svelte", "vanilla"])]
        framework: String,
    },

    /// List all apps
    List,

    /// Delete an app
    Remove {
        /// App ID
        app_id: String,

        /// Skip confirmation
        #[arg(long)]
        force: bool,
    },

    /// Edit app files
    Edit {
        /// App ID
        app_id: String,
    },

    /// Export app as ZIP
    Export {
        /// App ID
        app_id: String,

        /// Output path
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Import app from ZIP
    Import {
        /// ZIP file path
        path: PathBuf,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppManifest {
    pub id: String,
    pub name: String,
    pub framework: String,
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
    pub description: Option<String>,
    pub icon: Option<String>,
}

pub async fn execute(args: AppArgs, settings: Option<Settings>) -> Result<()> {
    match args.command {
        AppCommand::Create { name, framework } => create(&name, &framework, settings).await,
        AppCommand::List => list().await,
        AppCommand::Remove { app_id, force } => remove(&app_id, force).await,
        AppCommand::Edit { app_id } => edit(&app_id).await,
        AppCommand::Export { app_id, output } => export(&app_id, output).await,
        AppCommand::Import { path } => import(&path).await,
    }
}

fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

async fn create(name: &str, framework: &str, _settings: Option<Settings>) -> Result<()> {
    let paths = Paths::new(None)?;
    paths.ensure_dirs()?;

    let app_id = slugify(name);
    let app_dir = paths.app_path(&app_id);

    if app_dir.exists() {
        return Err(CnapseError::invalid_input(format!(
            "App '{}' already exists. Choose a different name.",
            app_id
        )));
    }

    ui::info(&format!("Creating app: {} ({})", name, framework));

    // Create app directory
    std::fs::create_dir_all(&app_dir)?;

    // Create manifest
    let now = chrono::Utc::now().to_rfc3339();
    let manifest = AppManifest {
        id: app_id.clone(),
        name: name.to_string(),
        framework: framework.to_string(),
        version: "1.0.0".to_string(),
        created_at: now.clone(),
        updated_at: now,
        description: None,
        icon: None,
    };

    let manifest_path = app_dir.join("manifest.json");
    let manifest_json = serde_json::to_string_pretty(&manifest)?;
    std::fs::write(&manifest_path, manifest_json)?;

    // Create template files based on framework
    match framework {
        "vue" => create_vue_template(&app_dir, name)?,
        "react" => create_react_template(&app_dir, name)?,
        "svelte" => create_svelte_template(&app_dir, name)?,
        "vanilla" => create_vanilla_template(&app_dir, name)?,
        _ => {
            return Err(CnapseError::invalid_input(format!(
                "Unknown framework: {}",
                framework
            )))
        }
    }

    ui::success(&format!("App created: {}", app_id));
    ui::kv("Location", &app_dir.to_string_lossy());
    ui::kv("Framework", framework);
    println!();
    ui::info("Edit the app with:");
    ui::list_item(&format!("cnapse app edit {}", app_id));
    println!();
    ui::info("Or start the server to view it:");
    ui::list_item("cnapse serve");

    Ok(())
}

fn create_vue_template(app_dir: &std::path::Path, name: &str) -> Result<()> {
    let index_html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <h1>{{{{ message }}}}</h1>
        <button @click="count++">Count: {{{{ count }}}}</button>
    </div>
    <script src="app.js"></script>
</body>
</html>
"#,
        name
    );

    let app_js = r#"const { createApp, ref } = Vue;

createApp({
    setup() {
        const message = ref('Hello from C-napse!');
        const count = ref(0);

        return {
            message,
            count
        };
    }
}).mount('#app');
"#;

    let style_css = r#"* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
}

#app {
    text-align: center;
    padding: 2rem;
}

h1 {
    margin-bottom: 1rem;
    font-size: 2rem;
}

button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    background: #0f3460;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
}

button:hover {
    background: #16a085;
}

@media (prefers-color-scheme: light) {
    body {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        color: #333;
    }
    button {
        background: #3498db;
    }
    button:hover {
        background: #2980b9;
    }
}
"#;

    std::fs::write(app_dir.join("index.html"), index_html)?;
    std::fs::write(app_dir.join("app.js"), app_js)?;
    std::fs::write(app_dir.join("style.css"), style_css)?;

    Ok(())
}

fn create_react_template(app_dir: &std::path::Path, name: &str) -> Result<()> {
    let index_html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="root"></div>
    <script type="text/babel" src="app.jsx"></script>
</body>
</html>
"#,
        name
    );

    let app_jsx = r#"const { useState } = React;

function App() {
    const [message] = useState('Hello from C-napse!');
    const [count, setCount] = useState(0);

    return (
        <div className="app">
            <h1>{message}</h1>
            <button onClick={() => setCount(c => c + 1)}>
                Count: {count}
            </button>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
"#;

    let style_css = r#"* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
}

.app {
    text-align: center;
    padding: 2rem;
}

h1 {
    margin-bottom: 1rem;
    font-size: 2rem;
}

button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    background: #0f3460;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
}

button:hover {
    background: #e94560;
}
"#;

    std::fs::write(app_dir.join("index.html"), index_html)?;
    std::fs::write(app_dir.join("app.jsx"), app_jsx)?;
    std::fs::write(app_dir.join("style.css"), style_css)?;

    Ok(())
}

fn create_svelte_template(app_dir: &std::path::Path, name: &str) -> Result<()> {
    // Svelte needs a build step, so we'll use a simple standalone version
    let index_html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <h1>Hello from C-napse!</h1>
        <button id="counter">Count: 0</button>
    </div>
    <script src="app.js"></script>
</body>
</html>
"#,
        name
    );

    let app_js = r#"// Simple vanilla JS (Svelte requires build step)
// Consider using Vue or React for CDN-based development

let count = 0;
const button = document.getElementById('counter');

button.addEventListener('click', () => {
    count++;
    button.textContent = `Count: ${count}`;
});
"#;

    let style_css = r#"* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #ff3e00 0%, #ff6b35 100%);
    color: #fff;
}

#app {
    text-align: center;
    padding: 2rem;
}

h1 {
    margin-bottom: 1rem;
}

button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    background: rgba(255,255,255,0.2);
    color: #fff;
    border: 2px solid #fff;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

button:hover {
    background: #fff;
    color: #ff3e00;
}
"#;

    std::fs::write(app_dir.join("index.html"), index_html)?;
    std::fs::write(app_dir.join("app.js"), app_js)?;
    std::fs::write(app_dir.join("style.css"), style_css)?;

    Ok(())
}

fn create_vanilla_template(app_dir: &std::path::Path, name: &str) -> Result<()> {
    let index_html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div id="app">
        <h1>Hello from C-napse!</h1>
        <button id="counter">Count: 0</button>
    </div>
    <script src="app.js"></script>
</body>
</html>
"#,
        name
    );

    let app_js = r#"// Vanilla JavaScript app
let count = 0;
const button = document.getElementById('counter');

button.addEventListener('click', () => {
    count++;
    button.textContent = `Count: ${count}`;
});

// Dark mode detection
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
}
"#;

    let style_css = r#"* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: #f5f5f5;
    color: #333;
    transition: all 0.3s;
}

body.dark {
    background: #1a1a1a;
    color: #fff;
}

#app {
    text-align: center;
    padding: 2rem;
}

h1 {
    margin-bottom: 1rem;
    font-size: 2rem;
}

button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    background: #333;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.1s;
}

button:hover {
    transform: scale(1.05);
}

button:active {
    transform: scale(0.95);
}

body.dark button {
    background: #fff;
    color: #333;
}
"#;

    std::fs::write(app_dir.join("index.html"), index_html)?;
    std::fs::write(app_dir.join("app.js"), app_js)?;
    std::fs::write(app_dir.join("style.css"), style_css)?;

    Ok(())
}

async fn list() -> Result<()> {
    let paths = Paths::new(None)?;
    let apps = paths.list_apps()?;

    ui::header("C-napse Apps");

    if apps.is_empty() {
        ui::info("No apps created yet.");
        println!();
        ui::info("Create an app with: cnapse app create \"My App\"");
        return Ok(());
    }

    let headers = ["ID", "Name", "Framework", "Updated"];
    let mut rows: Vec<Vec<String>> = Vec::new();

    for app_path in apps {
        let manifest_path = app_path.join("manifest.json");
        if let Ok(content) = std::fs::read_to_string(&manifest_path) {
            if let Ok(manifest) = serde_json::from_str::<AppManifest>(&content) {
                let updated = manifest
                    .updated_at
                    .split('T')
                    .next()
                    .unwrap_or(&manifest.updated_at);
                rows.push(vec![
                    manifest.id,
                    manifest.name,
                    manifest.framework,
                    updated.to_string(),
                ]);
            }
        }
    }

    ui::table(&headers, &rows);
    println!();

    Ok(())
}

async fn remove(app_id: &str, force: bool) -> Result<()> {
    let paths = Paths::new(None)?;
    let app_dir = paths.app_path(app_id);

    if !app_dir.exists() {
        return Err(CnapseError::not_found(format!("App not found: {}", app_id)));
    }

    if !force {
        ui::warning(&format!("This will permanently delete app '{}'", app_id));
        if !ui::confirm("Are you sure?") {
            ui::info("Cancelled.");
            return Ok(());
        }
    }

    std::fs::remove_dir_all(&app_dir)?;
    ui::success(&format!("Deleted app: {}", app_id));

    Ok(())
}

async fn edit(app_id: &str) -> Result<()> {
    let paths = Paths::new(None)?;
    let app_dir = paths.app_path(app_id);

    if !app_dir.exists() {
        return Err(CnapseError::not_found(format!("App not found: {}", app_id)));
    }

    // Try to open in VS Code, fall back to file manager
    let editors = ["code", "code-insiders", "codium"];
    let mut opened = false;

    for editor in editors {
        if std::process::Command::new(editor)
            .arg(&app_dir)
            .spawn()
            .is_ok()
        {
            ui::success(&format!("Opened {} in {}", app_id, editor));
            opened = true;
            break;
        }
    }

    if !opened {
        // Fall back to showing the path
        ui::info(&format!("App location: {}", app_dir.display()));
        ui::info("Open this directory in your preferred editor.");
    }

    Ok(())
}

async fn export(app_id: &str, output: Option<PathBuf>) -> Result<()> {
    let paths = Paths::new(None)?;
    let app_dir = paths.app_path(app_id);

    if !app_dir.exists() {
        return Err(CnapseError::not_found(format!("App not found: {}", app_id)));
    }

    let output_path = output.unwrap_or_else(|| {
        std::env::current_dir()
            .unwrap_or_default()
            .join(format!("{}.zip", app_id))
    });

    ui::info(&format!(
        "Exporting {} to {}",
        app_id,
        output_path.display()
    ));

    // TODO: Implement ZIP export
    ui::warning("ZIP export not yet implemented.");
    ui::info(&format!("App directory: {}", app_dir.display()));

    Ok(())
}

async fn import(path: &std::path::Path) -> Result<()> {
    if !path.exists() {
        return Err(CnapseError::not_found(format!(
            "File not found: {}",
            path.display()
        )));
    }

    ui::info(&format!("Importing from: {}", path.display()));

    // TODO: Implement ZIP import
    ui::warning("ZIP import not yet implemented.");

    Ok(())
}
