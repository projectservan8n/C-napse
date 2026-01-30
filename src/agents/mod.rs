//! Agent system for C-napse
//!
//! Each agent is a specialized AI that handles specific types of tasks.

pub mod traits;
pub mod router;
pub mod coder;
pub mod filer;
pub mod shell;
pub mod memory;
pub mod app;

pub use traits::{Agent, AgentContext, AgentMessage, AgentResponse, MessageRole};
