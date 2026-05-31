#!/usr/bin/env node

const { runCli } = require("../src/cli");

runCli(process.argv.slice(2)).catch((error) => {
  console.error(error.message || error);
  process.exit(error.exitCode || 1);
});
