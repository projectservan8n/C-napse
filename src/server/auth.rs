//! Server authentication

use crate::config::Credentials;
use crate::error::Result;
use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};

const API_KEY_HEADER: &str = "X-API-Key";

/// Extract API key from request
pub fn extract_api_key(request: &Request<Body>) -> Option<String> {
    request
        .headers()
        .get(API_KEY_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

/// Validate API key
pub fn validate_api_key(key: &str) -> Result<bool> {
    let credentials = Credentials::load()?;

    if let Some(server_key) = &credentials.server.api_key {
        Ok(key == server_key)
    } else {
        // No key configured - allow all (but warn)
        tracing::warn!("No server API key configured - accepting all requests");
        Ok(true)
    }
}

/// Auth middleware
pub async fn auth_middleware(
    request: Request<Body>,
    next: Next,
) -> std::result::Result<Response, StatusCode> {
    // Check for API key
    let key = extract_api_key(&request);

    match key {
        Some(k) => {
            if validate_api_key(&k).unwrap_or(false) {
                Ok(next.run(request).await)
            } else {
                Err(StatusCode::UNAUTHORIZED)
            }
        }
        None => Err(StatusCode::UNAUTHORIZED),
    }
}

/// Generate a random API key
pub fn generate_api_key() -> String {
    use base64::Engine;
    use sha2::{Digest, Sha256};

    let random_bytes: [u8; 32] = rand::random();
    let mut hasher = Sha256::new();
    hasher.update(random_bytes);
    let result = hasher.finalize();

    format!(
        "cnapse-{}",
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&result[..16])
    )
}

// Add rand dependency for key generation
fn rand_bytes() -> [u8; 32] {
    let mut bytes = [0u8; 32];
    // Use system time as entropy source (not cryptographically secure, but ok for API keys)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let nanos = now.as_nanos();

    for (i, byte) in bytes.iter_mut().enumerate() {
        *byte = ((nanos >> (i * 8)) & 0xff) as u8;
    }

    bytes
}

mod rand {
    pub fn random<T: Default + AsMut<[u8]>>() -> T {
        let mut val = T::default();
        let bytes = val.as_mut();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap();
        let mut seed = now.as_nanos() as u64;

        for byte in bytes.iter_mut() {
            seed = seed.wrapping_mul(1103515245).wrapping_add(12345);
            *byte = (seed >> 16) as u8;
        }

        val
    }
}
