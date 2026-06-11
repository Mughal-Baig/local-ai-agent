#!/usr/bin/env node
"use strict";

const { runCli } = require("../src/cli");

runCli(["chat", ...process.argv.slice(2)]).catch((error) => {
  console.error(error.message || error);
  process.exit(error.exitCode || 1);
});
