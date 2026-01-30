//! SQLite-based memory storage

use crate::config::Paths;
use crate::error::{CnapseError, Result};
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// A stored message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub agent: Option<String>,
    pub tokens: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

/// A stored session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSession {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub summary: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// A stored note
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredNote {
    pub id: String,
    pub content: String,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
}

/// Memory store backed by SQLite
pub struct MemoryStore {
    conn: Connection,
}

impl MemoryStore {
    /// Open or create the memory store
    pub fn open() -> Result<Self> {
        let paths = Paths::new(None)?;
        paths.ensure_dirs()?;

        let conn = Connection::open(&paths.memory_db)
            .map_err(|e| CnapseError::memory(format!("Failed to open database: {}", e)))?;

        let store = Self { conn };
        store.init_schema()?;

        Ok(store)
    }

    /// Initialize the database schema
    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                summary TEXT,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id),
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                agent TEXT,
                tokens INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                tags TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
            "#,
        )?;

        Ok(())
    }

    /// Create a new session
    pub fn create_session(&self) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        self.conn
            .execute("INSERT INTO sessions (id) VALUES (?1)", params![id])?;
        Ok(id)
    }

    /// Get or create current session
    pub fn get_or_create_session(&self) -> Result<String> {
        // Get most recent session from today
        let today = Utc::now().format("%Y-%m-%d").to_string();

        let result: Option<String> = self.conn
            .query_row(
                "SELECT id FROM sessions WHERE date(created_at) = ?1 ORDER BY created_at DESC LIMIT 1",
                params![today],
                |row| row.get(0),
            )
            .ok();

        match result {
            Some(id) => Ok(id),
            None => self.create_session(),
        }
    }

    /// Add a message to a session
    pub fn add_message(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
        agent: Option<&str>,
        tokens: Option<i32>,
    ) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO messages (id, session_id, role, content, agent, tokens) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, session_id, role, content, agent, tokens],
        )?;

        // Update session timestamp
        self.conn.execute(
            "UPDATE sessions SET updated_at = datetime('now') WHERE id = ?1",
            params![session_id],
        )?;

        Ok(id)
    }

    /// Get messages from a session
    pub fn get_messages(
        &self,
        session_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<StoredMessage>> {
        let limit = limit.unwrap_or(100);
        let mut stmt = self.conn.prepare(
            "SELECT id, session_id, role, content, agent, tokens, created_at, metadata
             FROM messages WHERE session_id = ?1 ORDER BY created_at DESC LIMIT ?2",
        )?;

        let messages = stmt
            .query_map(params![session_id, limit], |row| {
                Ok(StoredMessage {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    agent: row.get(4)?,
                    tokens: row.get(5)?,
                    created_at: row
                        .get::<_, String>(6)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                    metadata: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(messages)
    }

    /// Get recent sessions
    pub fn get_sessions(&self, limit: usize) -> Result<Vec<StoredSession>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, created_at, updated_at, summary, metadata
             FROM sessions ORDER BY updated_at DESC LIMIT ?1",
        )?;

        let sessions = stmt
            .query_map(params![limit], |row| {
                Ok(StoredSession {
                    id: row.get(0)?,
                    created_at: row
                        .get::<_, String>(1)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                    updated_at: row
                        .get::<_, String>(2)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                    summary: row.get(3)?,
                    metadata: row
                        .get::<_, Option<String>>(4)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(sessions)
    }

    /// Update session summary
    pub fn update_session_summary(&self, session_id: &str, summary: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE sessions SET summary = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![summary, session_id],
        )?;
        Ok(())
    }

    /// Save a note
    pub fn save_note(&self, content: &str, tags: &[String]) -> Result<String> {
        let id = uuid::Uuid::new_v4().to_string();
        let tags_json = serde_json::to_string(tags)?;
        self.conn.execute(
            "INSERT INTO notes (id, content, tags) VALUES (?1, ?2, ?3)",
            params![id, content, tags_json],
        )?;
        Ok(id)
    }

    /// Get notes, optionally filtered by tags
    pub fn get_notes(&self, tags: Option<&[String]>, limit: usize) -> Result<Vec<StoredNote>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content, tags, created_at FROM notes ORDER BY created_at DESC LIMIT ?1",
        )?;

        let notes: Vec<StoredNote> = stmt
            .query_map(params![limit], |row| {
                let tags_json: String = row.get(2)?;
                Ok(StoredNote {
                    id: row.get(0)?,
                    content: row.get(1)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    created_at: row
                        .get::<_, String>(3)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        // Filter by tags if specified
        if let Some(filter_tags) = tags {
            Ok(notes
                .into_iter()
                .filter(|n| filter_tags.iter().any(|t| n.tags.contains(t)))
                .collect())
        } else {
            Ok(notes)
        }
    }

    /// Search messages by content
    pub fn search_messages(&self, query: &str, limit: usize) -> Result<Vec<StoredMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, session_id, role, content, agent, tokens, created_at, metadata
             FROM messages WHERE content LIKE ?1 ORDER BY created_at DESC LIMIT ?2",
        )?;

        let pattern = format!("%{}%", query);
        let messages = stmt
            .query_map(params![pattern, limit], |row| {
                Ok(StoredMessage {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    agent: row.get(4)?,
                    tokens: row.get(5)?,
                    created_at: row
                        .get::<_, String>(6)?
                        .parse()
                        .unwrap_or_else(|_| Utc::now()),
                    metadata: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(messages)
    }

    /// Clear a session
    pub fn clear_session(&self, session_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM messages WHERE session_id = ?1",
            params![session_id],
        )?;
        self.conn
            .execute("DELETE FROM sessions WHERE id = ?1", params![session_id])?;
        Ok(())
    }
}
