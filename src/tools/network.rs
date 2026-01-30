//! Network utilities

use super::ToolResult;
use std::net::{TcpListener, TcpStream};
use std::time::Duration;

/// Check if a port is in use
pub fn check_port(port: u16) -> ToolResult {
    match TcpListener::bind(("127.0.0.1", port)) {
        Ok(_) => ToolResult::ok(format!("Port {} is available", port)),
        Err(_) => ToolResult::ok(format!("Port {} is in use", port)),
    }
}

/// Find available port in range
pub fn find_available_port(start: u16, end: u16) -> ToolResult {
    for port in start..=end {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return ToolResult::ok(port.to_string());
        }
    }

    ToolResult::err(format!("No available ports in range {}-{}", start, end))
}

/// Check if a host:port is reachable
pub fn check_connection(host: &str, port: u16, timeout_secs: u64) -> ToolResult {
    let addr = format!("{}:{}", host, port);
    let timeout = Duration::from_secs(timeout_secs);

    match TcpStream::connect_timeout(&addr.parse().unwrap(), timeout) {
        Ok(_) => ToolResult::ok(format!("Connection to {} successful", addr)),
        Err(e) => ToolResult::err(format!("Connection to {} failed: {}", addr, e)),
    }
}

/// Get local IP address
pub fn get_local_ip() -> ToolResult {
    match local_ip_address::local_ip() {
        Ok(ip) => ToolResult::ok(ip.to_string()),
        Err(e) => ToolResult::err(format!("Failed to get local IP: {}", e)),
    }
}

/// Get all network interfaces
pub fn list_interfaces() -> ToolResult {
    match local_ip_address::list_afinet_netifas() {
        Ok(interfaces) => {
            let info: Vec<String> = interfaces
                .iter()
                .map(|(name, ip)| format!("{}: {}", name, ip))
                .collect();

            ToolResult::ok(info.join("\n"))
        }
        Err(e) => ToolResult::err(format!("Failed to list interfaces: {}", e)),
    }
}
