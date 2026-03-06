import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../core/types.js";

function loadDotEnvFile(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function readOptionalList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolvePath(value: string | undefined, fallback: string): string {
  return path.resolve(process.cwd(), value || fallback);
}

export function loadConfig(): AppConfig {
  loadDotEnvFile();

  const dbPath = resolvePath(process.env.MINICLAW_DB_PATH, "data/miniclaw.db");
  const transcriptDir = resolvePath(process.env.MINICLAW_TRANSCRIPT_DIR, "data/transcripts");
  const authStorePath = resolvePath(process.env.MINICLAW_AUTH_STORE_PATH, "data/auth-profiles.json");
  const workspaceRoot = resolvePath(process.env.MINICLAW_WORKSPACE_ROOT, "workspace");
  const userProfilePath = resolvePath(process.env.MINICLAW_USER_PROFILE_PATH, "USER.md");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(transcriptDir, { recursive: true });
  fs.mkdirSync(path.dirname(authStorePath), { recursive: true });
  fs.mkdirSync(workspaceRoot, { recursive: true });

  return {
    discord: {
      token: process.env.DISCORD_TOKEN?.trim() || "",
      allowedUserIds: readOptionalList(process.env.DISCORD_ALLOWED_USER_IDS),
      allowedChannelIds: readOptionalList(process.env.DISCORD_ALLOWED_CHANNEL_IDS),
    },
    agent: {
      model: process.env.MINICLAW_MODEL?.trim() || "gpt-5-codex",
      workspaceRoot,
      userProfilePath,
    },
    runtime: {
      dbPath,
      transcriptDir,
      authStorePath,
    },
  };
}
