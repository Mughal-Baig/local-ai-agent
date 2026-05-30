"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

class SqliteStore {
  constructor(root, relativePath = ".agenttrail/agenttrail.db") {
    this.root = root;
    this.relativePath = relativePath;
    this.absolutePath = path.resolve(root, relativePath);
    this.available = false;
    this.error = null;
    this.db = null;
  }

  async init() {
    await fsp.mkdir(path.dirname(this.absolutePath), { recursive: true });
    try {
      const { DatabaseSync } = require("node:sqlite");
      this.db = new DatabaseSync(this.absolutePath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS records (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          created_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_records_type_created ON records(type, created_at);
      `);
      this.available = true;
    } catch (error) {
      this.error = error.message;
      this.available = false;
    }
    return this.status();
  }

  status() {
    return {
      path: this.relativePath,
      available: this.available,
      error: this.error,
      tables: this.available ? ["records"] : []
    };
  }

  insert(type, payload) {
    if (!this.available || !this.db) {
      return null;
    }
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      createdAt: new Date().toISOString(),
      payload
    };
    this.db
      .prepare("INSERT INTO records (id, type, created_at, payload) VALUES (?, ?, ?, ?)")
      .run(record.id, type, record.createdAt, JSON.stringify(payload || {}));
    return record;
  }

  list(type = "", limit = 100) {
    if (!this.available || !this.db) {
      return [];
    }
    const sql = type
      ? "SELECT id, type, created_at, payload FROM records WHERE type = ? ORDER BY created_at DESC LIMIT ?"
      : "SELECT id, type, created_at, payload FROM records ORDER BY created_at DESC LIMIT ?";
    const rows = type ? this.db.prepare(sql).all(type, limit) : this.db.prepare(sql).all(limit);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      createdAt: row.created_at,
      payload: safeJson(row.payload)
    }));
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

module.exports = {
  SqliteStore
};
