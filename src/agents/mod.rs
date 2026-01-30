//! Agent system for C-napse
//!
//! Each agent is a specialized AI that handles specific types of tasks.

pub mod app;
pub mod coder;
pub mod filer;
pub mod memory;
pub mod router;
pub mod shell;
pub mod traits;

pub use traits::{Agent, AgentContext, AgentMessage, AgentResponse, MessageRole};
