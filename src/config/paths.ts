import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function expandHome(input: string): string {
  if (!input.startsWith("~")) {
    return input;
  }
  return path.join(os.homedir(), input.slice(1));
}

export function resolveMiniclawStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MINICLAW_STATE_DIR?.trim();
  if (override) {
    return path.resolve(expandHome(override));
  }
  return path.join(os.homedir(), ".miniclaw");
}

export function ensureMiniclawStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const stateDir = resolveMiniclawStateDir(env);
  fs.mkdirSync(stateDir, { recursive: true });
  return stateDir;
}

export function resolveMiniclawConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MINICLAW_CONFIG_PATH?.trim();
  if (override) {
    return path.resolve(expandHome(override));
  }
  return path.join(resolveMiniclawStateDir(env), "miniclaw.json");
}

export function ensureMiniclawConfigFile(env: NodeJS.ProcessEnv = process.env): string {
  const configPath = resolveMiniclawConfigPath(env);
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
            note: "Primary MiniClaw config file.",
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

export function resolveMiniclawSkillsDir(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveMiniclawStateDir(env), "skills");
}

export function resolveGlobalAgentsSkillsDir(): string {
  return path.join(os.homedir(), ".agents", "skills");
}

export function resolveStateSubPath(
  value: string | undefined,
  fallbackRelativePath: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const stateDir = resolveMiniclawStateDir(env);
  if (!value?.trim()) {
    return path.join(stateDir, fallbackRelativePath);
  }

  const trimmed = value.trim();
  if (path.isAbsolute(trimmed) || trimmed.startsWith("~")) {
    return path.resolve(expandHome(trimmed));
  }
  return path.join(stateDir, trimmed);
}
