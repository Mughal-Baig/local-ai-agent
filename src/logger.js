"use strict";

const fsp = require("node:fs/promises");
const path = require("node:path");

class StructuredLogger {
  constructor(root, relativePath = ".agenttrail/logs.jsonl") {
    this.root = root;
    this.relativePath = relativePath;
    this.absolutePath = path.resolve(root, relativePath);
    this.recent = [];
  }

  async log(level, event, fields = {}) {
    const record = {
      schema: "agenttrail.log.v1",
      time: new Date().toISOString(),
      level,
      event,
      ...fields
    };
    this.recent.unshift(record);
    this.recent = this.recent.slice(0, 100);
    await fsp.mkdir(path.dirname(this.absolutePath), { recursive: true });
    await fsp.appendFile(this.absolutePath, `${JSON.stringify(record)}\n`, "utf8").catch(() => {});
    return record;
  }

  async list(limit = 80) {
    const raw = await fsp.readFile(this.absolutePath, "utf8").catch(() => "");
    const parsed = raw
      .split(/\r?\n/)
      .filter(Boolean)
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
    return parsed.length ? parsed : this.recent.slice(0, limit);
  }
}

module.exports = {
  StructuredLogger
};
