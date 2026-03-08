#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const copyJobs = [
  {
    sourceDir: path.join(projectRoot, "src", "ui", "web"),
    targetDir: path.join(projectRoot, "dist", "ui", "web"),
    mode: "files",
  },
  {
    sourceDir: path.join(projectRoot, "src", "skills"),
    targetDir: path.join(projectRoot, "dist", "skills"),
    mode: "tree",
  },
];

for (const job of copyJobs) {
  if (!fs.existsSync(job.sourceDir)) {
    continue;
  }

  fs.mkdirSync(job.targetDir, { recursive: true });

  if (job.mode === "tree") {
    for (const entry of fs.readdirSync(job.sourceDir, { withFileTypes: true })) {
      const sourcePath = path.join(job.sourceDir, entry.name);
      const targetPath = path.join(job.targetDir, entry.name);
      if (entry.isDirectory()) {
        fs.cpSync(sourcePath, targetPath, { recursive: true });
        continue;
      }
      if (entry.isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
    continue;
  }

  for (const entry of fs.readdirSync(job.sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const sourcePath = path.join(job.sourceDir, entry.name);
    const targetPath = path.join(job.targetDir, entry.name);
    fs.copyFileSync(sourcePath, targetPath);
  }
}
