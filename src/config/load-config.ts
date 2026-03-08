import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../core/types.js";
import {
  resolveBundledSkillsDir,
  ensureClawneoConfigFile,
  ensureClawneoStateDir,
  resolveGlobalAgentsSkillsDir,
  resolveClawneoSkillsDir,
  resolveStateSubPath,
} from "./paths.js";

type JsonConfig = {
  discord?: {
    token?: unknown;
    allowedUserIds?: unknown;
    allowedGuildIds?: unknown;
    allowedChannelIds?: unknown;
  };
  agent?: {
    model?: unknown;
    workspaceRoot?: unknown;
    toolCwd?: unknown;
  };
  runtime?: {
    dbPath?: unknown;
    transcriptDir?: unknown;
    authStorePath?: unknown;
    stateDir?: unknown;
  };
};

function readJsonConfig(configPath: string): JsonConfig {
  try {
    const raw = fs.readFileSync(configPath, "utf8").trim();
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("config root must be a JSON object");
    }
    return parsed as JsonConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load ClawNeo config from ${configPath}: ${message}`);
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export function loadConfig(): AppConfig {
  const stateDir = ensureClawneoStateDir(process.env);
  const configPath = ensureClawneoConfigFile(process.env);
  const fileConfig = readJsonConfig(configPath);
  const dbPath = resolveStateSubPath(
    readString(fileConfig.runtime?.dbPath) ?? process.env.CLAWNEO_DB_PATH,
    "clawneo.db",
    process.env,
  );
  const transcriptDir = resolveStateSubPath(
    readString(fileConfig.runtime?.transcriptDir) ?? process.env.CLAWNEO_TRANSCRIPT_DIR,
    "transcripts",
    process.env,
  );
  const authStorePath = resolveStateSubPath(
    readString(fileConfig.runtime?.authStorePath) ?? process.env.CLAWNEO_AUTH_STORE_PATH,
    "auth-profiles.json",
    process.env,
  );
  const workspaceRoot = resolveStateSubPath(
    readString(fileConfig.agent?.workspaceRoot) ?? process.env.CLAWNEO_WORKSPACE_ROOT,
    "workspace",
    process.env,
  );
  const toolCwd = resolveAbsolutePath(
    readString(fileConfig.agent?.toolCwd) ?? process.env.CLAWNEO_TOOL_CWD,
    process.env.HOME || process.cwd(),
  );
  const userProfilePath = resolveStateSubPath(
    undefined,
    path.join("workspace", "USER.md"),
    process.env,
  );
  const skillsDirs = [
    resolveBundledSkillsDir(import.meta.url),
    resolveGlobalAgentsSkillsDir(),
    resolveClawneoSkillsDir(process.env),
  ];

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(transcriptDir, { recursive: true });
  fs.mkdirSync(path.dirname(authStorePath), { recursive: true });
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.mkdirSync(path.dirname(userProfilePath), { recursive: true });
  fs.mkdirSync(resolveClawneoSkillsDir(process.env), { recursive: true });

  return {
    discord: {
      token: (readString(fileConfig.discord?.token) ?? process.env.DISCORD_TOKEN?.trim()) || "",
      allowedUserIds:
        readList(fileConfig.discord?.allowedUserIds) ??
        readOptionalList(process.env.DISCORD_ALLOWED_USER_IDS),
      allowedGuildIds:
        readList(fileConfig.discord?.allowedGuildIds) ??
        readList(fileConfig.discord?.allowedChannelIds) ??
        readOptionalList(
          process.env.DISCORD_ALLOWED_GUILD_IDS || process.env.DISCORD_ALLOWED_CHANNEL_IDS,
        ),
    },
    agent: {
      model:
        (readString(fileConfig.agent?.model) ?? process.env.CLAWNEO_MODEL?.trim()) ||
        "gpt-5-codex",
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
      skillsDirs,
    },
  };
}
