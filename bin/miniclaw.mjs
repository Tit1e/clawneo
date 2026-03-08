#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const distEntry = path.join(projectRoot, "dist", "cli", "run-main.js");
const srcEntry = path.join(projectRoot, "src", "cli", "run-main.ts");

const childArgs = fs.existsSync(distEntry)
  ? [distEntry, ...process.argv.slice(2)]
  : ["--import", "tsx", srcEntry, ...process.argv.slice(2)];

const child = spawn(process.execPath, childArgs, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
