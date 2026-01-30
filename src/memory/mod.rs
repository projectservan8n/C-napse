//! Memory system for C-napse
//!
//! Manages conversation context with hot/warm/cold storage hierarchy.

pub mod context;
pub mod embeddings;
pub mod store;

pub use context::ContextManager;
pub use store::MemoryStore;
