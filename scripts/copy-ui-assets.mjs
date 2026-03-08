#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "src", "ui", "web");
const targetDir = path.join(projectRoot, "dist", "ui", "web");

fs.mkdirSync(targetDir, { recursive: true });

for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isFile()) {
    continue;
  }

  const sourcePath = path.join(sourceDir, entry.name);
  const targetPath = path.join(targetDir, entry.name);
  fs.copyFileSync(sourcePath, targetPath);
}
