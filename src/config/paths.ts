import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function expandHome(input: string): string {
  if (!input.startsWith("~")) {
    return input;
  }
  return path.join(os.homedir(), input.slice(1));
}

export function resolveClawneoStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CLAWNEO_STATE_DIR?.trim();
  if (override) {
    return path.resolve(expandHome(override));
  }
  return path.join(os.homedir(), ".clawneo");
}

export function ensureClawneoStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateDir = resolveClawneoStateDir(env);
  fs.mkdirSync(stateDir, { recursive: true });
  return stateDir;
}

export function resolveClawneoConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CLAWNEO_CONFIG_PATH?.trim();
  if (override) {
    return path.resolve(expandHome(override));
  }
  return path.join(resolveClawneoStateDir(env), "clawneo.json");
}

export function ensureClawneoConfigFile(env: NodeJS.ProcessEnv = process.env): string {
  const configPath = resolveClawneoConfigPath(env);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          discord: {
            token: "",
            allowedUserIds: [],
            allowedGuildIds: [],
          },
          agent: {
            model: "gpt-5-codex",
          },
          runtime: {
            note: "Primary ClawNeo config file.",
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  return configPath;
}

export function resolveClawneoSkillsDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveClawneoStateDir(env), "skills");
}

export function resolveGlobalAgentsSkillsDir(): string {
  return path.join(os.homedir(), ".agents", "skills");
}

export function resolveBundledSkillsDir(fromModuleUrl: string | URL = import.meta.url): string {
  const moduleDir = path.dirname(fileURLToPath(fromModuleUrl));
  return path.resolve(moduleDir, "..", "skills");
}

export function resolveStateSubPath(
  value: string | undefined,
  fallbackRelativePath: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const stateDir = resolveClawneoStateDir(env);
  if (!value?.trim()) {
    return path.join(stateDir, fallbackRelativePath);
  }

  const trimmed = value.trim();
  if (path.isAbsolute(trimmed) || trimmed.startsWith("~")) {
    return path.resolve(expandHome(trimmed));
  }
  return path.join(stateDir, trimmed);
}
