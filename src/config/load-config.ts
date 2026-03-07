import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../core/types.js";
import {
  ensureMiniclawConfigFile,
  ensureMiniclawStateDir,
  resolveStateSubPath,
} from "./paths.js";

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

function resolveAbsolutePath(value: string | undefined, fallback: string): string {
  return path.resolve(process.cwd(), value || fallback);
}

export function loadConfig(): AppConfig {
  loadDotEnvFile();

  const stateDir = ensureMiniclawStateDir(process.env);
  const configPath = ensureMiniclawConfigFile(process.env);
  const dbPath = resolveStateSubPath(process.env.MINICLAW_DB_PATH, "miniclaw.db", process.env);
  const transcriptDir = resolveStateSubPath(
    process.env.MINICLAW_TRANSCRIPT_DIR,
    "transcripts",
    process.env,
  );
  const authStorePath = resolveStateSubPath(
    process.env.MINICLAW_AUTH_STORE_PATH,
    "auth-profiles.json",
    process.env,
  );
  const workspaceRoot = resolveStateSubPath(
    process.env.MINICLAW_WORKSPACE_ROOT,
    "workspace",
    process.env,
  );
  const toolCwd = resolveAbsolutePath(
    process.env.MINICLAW_TOOL_CWD,
    process.env.HOME || process.cwd(),
  );
  const userProfilePath = resolveStateSubPath(
    process.env.MINICLAW_USER_PROFILE_PATH,
    path.join("workspace", "USER.md"),
    process.env,
  );

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(transcriptDir, { recursive: true });
  fs.mkdirSync(path.dirname(authStorePath), { recursive: true });
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.mkdirSync(path.dirname(userProfilePath), { recursive: true });

  return {
    discord: {
      token: process.env.DISCORD_TOKEN?.trim() || "",
      allowedUserIds: readOptionalList(process.env.DISCORD_ALLOWED_USER_IDS),
      allowedGuildIds: readOptionalList(
        process.env.DISCORD_ALLOWED_GUILD_IDS || process.env.DISCORD_ALLOWED_CHANNEL_IDS,
      ),
    },
    agent: {
      model: process.env.MINICLAW_MODEL?.trim() || "gpt-5-codex",
      workspaceRoot,
      toolCwd,
      userProfilePath,
    },
    runtime: {
      stateDir,
      configPath,
      dbPath,
      transcriptDir,
      authStorePath,
    },
  };
}
