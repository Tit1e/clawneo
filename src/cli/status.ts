import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import chalk from "chalk";
import { ensureAuthStore, resolveDefaultOpenAICodexProfile } from "../auth/store.js";
import { loadConfig } from "../config/load-config.js";

export type StatusSnapshot = {
  process: {
    running: boolean;
    pid: number | null;
    uptimeMs: number | null;
  };
  runtime: {
    pidFile: string;
    logFile: string;
    dbPath: string;
    transcriptDir: string;
  };
  discord: {
    tokenConfigured: boolean;
    allowedUsers: number;
    allowedGuilds: number;
  };
  model: {
    model: string;
    authStore: string;
    defaultProfileId: string | null;
    oauthProfileCount: number;
    authUsable: boolean;
    tokenExpired: boolean | null;
  };
  logs: string[];
};

export function resolveDataDir(): string {
  return path.resolve(process.cwd(), "data");
}

export function resolvePidPath(): string {
  return path.join(resolveDataDir(), "miniclaw.pid");
}

export function resolveLogPath(): string {
  return path.join(resolveDataDir(), "miniclaw.log");
}

export function ensureDataDir(): void {
  fs.mkdirSync(resolveDataDir(), { recursive: true });
}

export function readPid(): number | null {
  const pidPath = resolvePidPath();
  if (!fs.existsSync(pidPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(pidPath, "utf8").trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function removePidFile(): void {
  const pidPath = resolvePidPath();
  if (!fs.existsSync(pidPath)) {
    return;
  }
  try {
    fs.rmSync(pidPath, { force: true });
  } catch {
    // ignore cleanup errors
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    if (code === "ESRCH") {
      return false;
    }
    if (code === "EPERM") {
      return true;
    }
    return false;
  }
}

export function ensureFreshPidState(): number | null {
  const pid = readPid();
  if (!pid) {
    removePidFile();
    return null;
  }
  if (isProcessRunning(pid)) {
    return pid;
  }
  removePidFile();
  return null;
}

export function writePid(pid: number): void {
  ensureDataDir();
  fs.writeFileSync(resolvePidPath(), `${pid}\n`, "utf8");
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function tailLines(filePath: string, maxLines: number): string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const lines = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").trimEnd().split("\n");
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function getPidFileMtimeMs(): number | null {
  const pidPath = resolvePidPath();
  if (!fs.existsSync(pidPath)) {
    return null;
  }
  try {
    return fs.statSync(pidPath).mtimeMs;
  } catch {
    return null;
  }
}

function colorBoolean(value: boolean): string {
  return value ? chalk.green("yes") : chalk.red("no");
}

function colorExpired(value: boolean): string {
  return value ? chalk.yellow("yes") : chalk.green("no");
}

function sectionTitle(label: string): string {
  return chalk.bold.cyan(label);
}

function renderField(label: string, value: string): string {
  return `${chalk.dim("-")} ${chalk.bold(label)}: ${value}`;
}

function renderPathField(label: string, value: string): string {
  return renderField(label, chalk.dim(value));
}

function renderLogLine(value: string): string {
  return `${chalk.dim("-")} ${chalk.gray(value)}`;
}

export function collectStatusSnapshot(): StatusSnapshot {
  const config = loadConfig();
  const runningPid = ensureFreshPidState();
  const pidFileMtimeMs = getPidFileMtimeMs();
  const logPath = resolveLogPath();
  const authStore = ensureAuthStore(config.runtime.authStorePath);
  const defaultProfile = resolveDefaultOpenAICodexProfile(authStore);
  const defaultCredential = defaultProfile?.credential;
  const recentLogs = tailLines(logPath, 10);
  const tokenExpired =
    defaultCredential?.type === "oauth"
      ? Date.now() >= defaultCredential.expires
      : defaultCredential?.type === "token"
        ? Boolean(defaultCredential.expires && Date.now() >= defaultCredential.expires)
        : null;

  return {
    process: {
      running: Boolean(runningPid),
      pid: runningPid,
      uptimeMs: runningPid && pidFileMtimeMs ? Date.now() - pidFileMtimeMs : null,
    },
    runtime: {
      pidFile: resolvePidPath(),
      logFile: logPath,
      dbPath: config.runtime.dbPath,
      transcriptDir: config.runtime.transcriptDir,
    },
    discord: {
      tokenConfigured: Boolean(config.discord.token),
      allowedUsers: config.discord.allowedUserIds.length,
      allowedGuilds: config.discord.allowedGuildIds.length,
    },
    model: {
      model: config.agent.model,
      authStore: config.runtime.authStorePath,
      defaultProfileId: defaultProfile?.profileId ?? null,
      oauthProfileCount: Object.keys(authStore.profiles).length,
      authUsable: Boolean(defaultProfile),
      tokenExpired,
    },
    logs: recentLogs,
  };
}

export function renderStatusText(snapshot: StatusSnapshot): string {
  const lines: string[] = [];
  lines.push(chalk.bold.blue("MiniClaw Status"), "");

  lines.push(sectionTitle("Process"));
  lines.push(renderField("running", colorBoolean(snapshot.process.running)));
  lines.push(
    renderField(
      "pid",
      snapshot.process.pid ? chalk.green(String(snapshot.process.pid)) : chalk.dim("-"),
    ),
  );
  lines.push(
    renderField(
      "uptime",
      snapshot.process.uptimeMs ? chalk.green(formatDuration(snapshot.process.uptimeMs)) : chalk.dim("-"),
    ),
  );
  lines.push("");

  lines.push(sectionTitle("Runtime"));
  lines.push(renderPathField("pid file", snapshot.runtime.pidFile));
  lines.push(renderPathField("log file", snapshot.runtime.logFile));
  lines.push(renderPathField("db path", snapshot.runtime.dbPath));
  lines.push(renderPathField("transcripts", snapshot.runtime.transcriptDir));
  lines.push("");

  lines.push(sectionTitle("Discord"));
  lines.push(renderField("token", colorBoolean(snapshot.discord.tokenConfigured)));
  lines.push(renderField("allowed users", chalk.yellow(String(snapshot.discord.allowedUsers))));
  lines.push(renderField("allowed guilds", chalk.yellow(String(snapshot.discord.allowedGuilds))));
  lines.push("");

  lines.push(sectionTitle("Model"));
  lines.push(renderField("model", chalk.magenta(snapshot.model.model)));
  lines.push(
    renderField(
      "default profile",
      snapshot.model.defaultProfileId ? chalk.green(snapshot.model.defaultProfileId) : chalk.dim("-"),
    ),
  );
  lines.push(renderField("profiles", chalk.yellow(String(snapshot.model.oauthProfileCount))));
  lines.push(renderField("auth usable", colorBoolean(snapshot.model.authUsable)));
  lines.push(
    renderField(
      "token expired",
      snapshot.model.tokenExpired === null ? chalk.dim("-") : colorExpired(snapshot.model.tokenExpired),
    ),
  );
  lines.push(renderPathField("auth store", snapshot.model.authStore));
  lines.push("");

  lines.push(sectionTitle("Recent log tail"));
  if (snapshot.logs.length === 0) {
    lines.push(renderLogLine("(no log lines)"));
  } else {
    for (const line of snapshot.logs) {
      lines.push(renderLogLine(line));
    }
  }

  return lines.join("\n");
}
