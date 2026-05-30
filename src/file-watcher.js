"use strict";

const fs = require("node:fs");

class FileWatcher {
  constructor(root, onChange) {
    this.root = root;
    this.onChange = onChange;
    this.watcher = null;
    this.events = [];
    this.startedAt = null;
  }

  start() {
    if (this.watcher) {
      return this.status();
    }
    this.startedAt = new Date().toISOString();
    this.watcher = fs.watch(this.root, { recursive: true }, (eventType, filename) => {
      const event = {
        eventType,
        path: String(filename || ""),
        time: new Date().toISOString()
      };
      this.events.unshift(event);
      this.events = this.events.slice(0, 80);
      if (this.onChange) {
        this.onChange(event);
      }
    });
    return this.status();
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    return this.status();
  }

  status() {
    return {
      active: Boolean(this.watcher),
      root: this.root,
      startedAt: this.startedAt,
      events: this.events.slice(0, 20)
    };
  }
}

module.exports = {
  FileWatcher
};
