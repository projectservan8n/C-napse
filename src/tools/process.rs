//! Process management tools

use super::ToolResult;
use sysinfo::{System, Pid, ProcessStatus};

/// List running processes
pub fn list_processes() -> ToolResult {
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut processes: Vec<String> = sys
        .processes()
        .iter()
        .map(|(pid, process)| {
            format!(
                "{}\t{}\t{:.1}%\t{:.1} MB\t{}",
                pid,
                process.name().to_str().unwrap_or("?"),
                process.cpu_usage(),
                process.memory() as f64 / 1024.0 / 1024.0,
                match process.status() {
                    ProcessStatus::Run => "Running",
                    ProcessStatus::Sleep => "Sleep",
                    ProcessStatus::Stop => "Stopped",
                    ProcessStatus::Zombie => "Zombie",
                    _ => "Unknown",
                }
            )
        })
        .collect();

    processes.sort();

    let header = "PID\tName\tCPU\tMemory\tStatus";
    ToolResult::ok(format!("{}\n{}", header, processes.join("\n")))
}

/// Get information about a specific process
pub fn process_info(pid: u32) -> ToolResult {
    let mut sys = System::new_all();
    sys.refresh_all();

    let pid = Pid::from_u32(pid);

    match sys.process(pid) {
        Some(process) => {
            let info = format!(
                "PID: {}\nName: {}\nCPU: {:.1}%\nMemory: {:.1} MB\nStatus: {:?}\nCommand: {:?}",
                pid,
                process.name().to_str().unwrap_or("?"),
                process.cpu_usage(),
                process.memory() as f64 / 1024.0 / 1024.0,
                process.status(),
                process.cmd()
            );
            ToolResult::ok(info)
        }
        None => ToolResult::err(format!("Process not found: {}", pid)),
    }
}

/// Kill a process
pub fn kill_process(pid: u32) -> ToolResult {
    let mut sys = System::new_all();
    sys.refresh_all();

    let pid = Pid::from_u32(pid);

    match sys.process(pid) {
        Some(process) => {
            if process.kill() {
                ToolResult::ok(format!("Killed process: {}", pid))
            } else {
                ToolResult::err(format!("Failed to kill process: {}", pid))
            }
        }
        None => ToolResult::err(format!("Process not found: {}", pid)),
    }
}

/// Find processes by name
pub fn find_process(name: &str) -> ToolResult {
    let mut sys = System::new_all();
    sys.refresh_all();

    let matches: Vec<String> = sys
        .processes()
        .iter()
        .filter(|(_, process)| {
            process
                .name()
                .to_str()
                .unwrap_or("")
                .to_lowercase()
                .contains(&name.to_lowercase())
        })
        .map(|(pid, process)| {
            format!(
                "{}\t{}\t{:.1}%",
                pid,
                process.name().to_str().unwrap_or("?"),
                process.cpu_usage()
            )
        })
        .collect();

    if matches.is_empty() {
        ToolResult::err(format!("No processes found matching: {}", name))
    } else {
        ToolResult::ok(format!("PID\tName\tCPU\n{}", matches.join("\n")))
    }
}

/// Get system information
pub fn system_info() -> ToolResult {
    let mut sys = System::new_all();
    sys.refresh_all();

    let info = format!(
        "OS: {} {}\nHostname: {}\nCPUs: {}\nTotal Memory: {:.1} GB\nUsed Memory: {:.1} GB\nProcesses: {}",
        System::name().unwrap_or_default(),
        System::os_version().unwrap_or_default(),
        System::host_name().unwrap_or_default(),
        sys.cpus().len(),
        sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0,
        sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0,
        sys.processes().len()
    );

    ToolResult::ok(info)
}
