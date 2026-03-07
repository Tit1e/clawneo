#!/usr/bin/env node

import { spawn } from "node:child_process";

const child = spawn(
  process.execPath,
  ["--import", "tsx", "src/cli/run-main.ts", ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
