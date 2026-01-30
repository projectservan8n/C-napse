//! File system tools

use super::ToolResult;
use std::path::Path;

/// Read file contents
pub fn read_file(path: &str) -> ToolResult {
    match std::fs::read_to_string(path) {
        Ok(content) => ToolResult::ok(content),
        Err(e) => ToolResult::err(format!("Failed to read file: {}", e)),
    }
}

/// Write file contents
pub fn write_file(path: &str, content: &str) -> ToolResult {
    // Create parent directories if needed
    if let Some(parent) = Path::new(path).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return ToolResult::err(format!("Failed to create directory: {}", e));
        }
    }

    match std::fs::write(path, content) {
        Ok(()) => ToolResult::ok(format!("Written {} bytes to {}", content.len(), path)),
        Err(e) => ToolResult::err(format!("Failed to write file: {}", e)),
    }
}

/// List directory contents
pub fn list_dir(path: &str, recursive: bool) -> ToolResult {
    let path = Path::new(path);

    if !path.exists() {
        return ToolResult::err(format!("Path does not exist: {}", path.display()));
    }

    if !path.is_dir() {
        return ToolResult::err(format!("Not a directory: {}", path.display()));
    }

    let mut entries = Vec::new();

    if recursive {
        fn walk_dir(dir: &Path, entries: &mut Vec<String>, prefix: &str) -> std::io::Result<()> {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                let display = if prefix.is_empty() {
                    name.clone()
                } else {
                    format!("{}/{}", prefix, name)
                };

                if path.is_dir() {
                    entries.push(format!("{}/", display));
                    walk_dir(&path, entries, &display)?;
                } else {
                    entries.push(display);
                }
            }
            Ok(())
        }

        if let Err(e) = walk_dir(path, &mut entries, "") {
            return ToolResult::err(format!("Failed to read directory: {}", e));
        }
    } else {
        match std::fs::read_dir(path) {
            Ok(dir) => {
                for entry in dir.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if entry.path().is_dir() {
                        entries.push(format!("{}/", name));
                    } else {
                        entries.push(name);
                    }
                }
            }
            Err(e) => return ToolResult::err(format!("Failed to read directory: {}", e)),
        }
    }

    entries.sort();
    ToolResult::ok(entries.join("\n"))
}

/// Copy file or directory
pub fn copy(src: &str, dst: &str) -> ToolResult {
    let src_path = Path::new(src);
    let dst_path = Path::new(dst);

    if !src_path.exists() {
        return ToolResult::err(format!("Source does not exist: {}", src));
    }

    if src_path.is_file() {
        // Copy single file
        if let Some(parent) = dst_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                return ToolResult::err(format!("Failed to create directory: {}", e));
            }
        }

        match std::fs::copy(src_path, dst_path) {
            Ok(bytes) => ToolResult::ok(format!("Copied {} bytes from {} to {}", bytes, src, dst)),
            Err(e) => ToolResult::err(format!("Failed to copy: {}", e)),
        }
    } else {
        // Copy directory recursively
        ToolResult::err("Directory copy not yet implemented")
    }
}

/// Move/rename file or directory
pub fn move_path(src: &str, dst: &str) -> ToolResult {
    match std::fs::rename(src, dst) {
        Ok(()) => ToolResult::ok(format!("Moved {} to {}", src, dst)),
        Err(e) => ToolResult::err(format!("Failed to move: {}", e)),
    }
}

/// Delete file or directory
pub fn delete(path: &str, force: bool) -> ToolResult {
    let path = Path::new(path);

    if !path.exists() {
        return ToolResult::err(format!("Path does not exist: {}", path.display()));
    }

    if path.is_dir() {
        if force {
            match std::fs::remove_dir_all(path) {
                Ok(()) => ToolResult::ok(format!("Deleted directory: {}", path.display())),
                Err(e) => ToolResult::err(format!("Failed to delete: {}", e)),
            }
        } else {
            ToolResult::err("Use force=true to delete directories")
        }
    } else {
        match std::fs::remove_file(path) {
            Ok(()) => ToolResult::ok(format!("Deleted file: {}", path.display())),
            Err(e) => ToolResult::err(format!("Failed to delete: {}", e)),
        }
    }
}

/// Get file metadata
pub fn file_info(path: &str) -> ToolResult {
    let path = Path::new(path);

    match std::fs::metadata(path) {
        Ok(meta) => {
            let file_type = if meta.is_dir() {
                "directory"
            } else if meta.is_file() {
                "file"
            } else {
                "other"
            };

            let size = meta.len();
            let readonly = meta.permissions().readonly();

            let modified = meta
                .modified()
                .ok()
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Local> = t.into();
                    datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                })
                .unwrap_or_else(|| "unknown".to_string());

            ToolResult::ok(format!(
                "Type: {}\nSize: {} bytes\nModified: {}\nRead-only: {}",
                file_type, size, modified, readonly
            ))
        }
        Err(e) => ToolResult::err(format!("Failed to get file info: {}", e)),
    }
}
