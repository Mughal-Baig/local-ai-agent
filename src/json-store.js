"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

class JsonLineStore {
  constructor(root, relativePath = ".agenttrail/store.jsonl") {
    this.root = root;
    this.relativePath = relativePath;
    this.absolutePath = path.resolve(root, relativePath);
  }

  async append(type, payload) {
    await fsp.mkdir(path.dirname(this.absolutePath), { recursive: true });
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      createdAt: new Date().toISOString(),
      payload
    };
    await fsp.appendFile(this.absolutePath, `${JSON.stringify(record)}\n`, "utf8");
    return record;
  }

  async list(limit = 100) {
    const raw = await fsp.readFile(this.absolutePath, "utf8").catch(() => "");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines
      .slice(-Math.max(1, limit))
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  }

  async stats() {
    const records = await this.list(1000);
    const byType = {};
    for (const record of records) {
      byType[record.type] = (byType[record.type] || 0) + 1;
    }
    return {
      path: this.relativePath,
      count: records.length,
      byType,
      latest: records[0] || null
    };
  }
}

module.exports = {
  JsonLineStore
};
