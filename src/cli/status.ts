import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { ensureAuthStore, resolveDefaultOpenAICodexProfile } from "../auth/store.js";
import { ensureClawneoStateDir, resolveClawneoStateDir } from "../config/paths.js";
import { loadConfig } from "../config/load-config.js";

export type StatusSnapshot = {
  app: {
    version: string;
    nodeVersion: string;
    platform: string;
  };
  process: {
    running: boolean;
    pid: number | null;
    uptimeMs: number | null;
  };
  runtime: {
    stateDir: string;
    configPath: string;
    pidFile: string;
    logFile: string;
    dbPath: string;
    transcriptDir: string;
    skillsDirs: string[];
    skillsDirStats: Array<{
      path: string;
      skillsCount: number;
    }>;
    dbSizeBytes: number | null;
    logSizeBytes: number | null;
    transcriptFileCount: number;
    skillsCount: number;
  };
  discord: {
    tokenConfigured: boolean;
    allowedUsers: number;
    allowedGuilds: number;
    accessMode: "unrestricted" | "users_only" | "guilds_only" | "users_and_guilds";
  };
  model: {
    model: string;
    authStore: string;
    defaultProfileId: string | null;
    oauthProfileCount: number;
    authUsable: boolean;
    tokenExpired: boolean | null;
    credentialType: "oauth" | "token" | null;
  };
  logs: string[];
};

export function resolveDataDir(): string {
  return resolveClawneoStateDir();
}

export function resolvePidPath(): string {
  return path.join(resolveDataDir(), "clawneo.pid");
}

export function resolveLogPath(): string {
  return path.join(resolveDataDir(), "clawneo.log");
}

export function ensureDataDir(): void {
  ensureClawneoStateDir();
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

function readPackageVersion(): string {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const packagePath = path.resolve(currentDir, "../../package.json");
    const raw = fs.readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.trim() ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
}

function readFileSize(filePath: string): number | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

function countTranscriptFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }
  try {
    return fs.readdirSync(dirPath).filter((entry) => entry.endsWith(".jsonl")).length;
  } catch {
    return 0;
  }
}

function countSkills(skillsDirs: string[]): number {
  let total = 0;
  for (const skillsDir of skillsDirs) {
    if (!fs.existsSync(skillsDir)) {
      continue;
    }
    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md"))) {
          total += 1;
        }
      }
    } catch {
      // ignore scan failures per directory
    }
  }
  return total;
}

function collectSkillsDirStats(skillsDirs: string[]): Array<{ path: string; skillsCount: number }> {
  return skillsDirs.map((skillsDir) => {
    let skillsCount = 0;
    if (fs.existsSync(skillsDir)) {
      try {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }
          if (fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md"))) {
            skillsCount += 1;
          }
        }
      } catch {
        skillsCount = 0;
      }
    }
    return {
      path: skillsDir,
      skillsCount,
    };
  });
}

function resolveDiscordAccessMode(
  allowedUsers: number,
  allowedGuilds: number,
): StatusSnapshot["discord"]["accessMode"] {
  if (allowedUsers > 0 && allowedGuilds > 0) {
    return "users_and_guilds";
  }
  if (allowedUsers > 0) {
    return "users_only";
  }
  if (allowedGuilds > 0) {
    return "guilds_only";
  }
  return "unrestricted";
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const skillsDirStats = collectSkillsDirStats(config.runtime.skillsDirs);
  const allowedUsers = config.discord.allowedUserIds.length;
  const allowedGuilds = config.discord.allowedGuildIds.length;
  const tokenExpired =
    defaultCredential?.type === "oauth"
      ? Date.now() >= defaultCredential.expires
      : defaultCredential?.type === "token"
        ? Boolean(defaultCredential.expires && Date.now() >= defaultCredential.expires)
        : null;

  return {
    app: {
      version: readPackageVersion(),
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch}`,
    },
    process: {
      running: Boolean(runningPid),
      pid: runningPid,
      uptimeMs: runningPid && pidFileMtimeMs ? Date.now() - pidFileMtimeMs : null,
    },
    runtime: {
      stateDir: config.runtime.stateDir,
      configPath: config.runtime.configPath,
      pidFile: resolvePidPath(),
      logFile: logPath,
      dbPath: config.runtime.dbPath,
      transcriptDir: config.runtime.transcriptDir,
      skillsDirs: config.runtime.skillsDirs,
      skillsDirStats,
      dbSizeBytes: readFileSize(config.runtime.dbPath),
      logSizeBytes: readFileSize(logPath),
      transcriptFileCount: countTranscriptFiles(config.runtime.transcriptDir),
      skillsCount: countSkills(config.runtime.skillsDirs),
    },
    discord: {
      tokenConfigured: Boolean(config.discord.token),
      allowedUsers,
      allowedGuilds,
      accessMode: resolveDiscordAccessMode(allowedUsers, allowedGuilds),
    },
    model: {
      model: config.agent.model,
      authStore: config.runtime.authStorePath,
      defaultProfileId: defaultProfile?.profileId ?? null,
      oauthProfileCount: Object.keys(authStore.profiles).length,
      authUsable: Boolean(defaultProfile),
      tokenExpired,
      credentialType: defaultCredential?.type ?? null,
    },
    logs: recentLogs,
  };
}

export function renderStatusText(snapshot: StatusSnapshot): string {
  const lines: string[] = [];
  lines.push(chalk.bold.blue("ClawNeo Status"), "");

  lines.push(sectionTitle("App"));
  lines.push(renderField("version", chalk.magenta(snapshot.app.version)));
  lines.push(renderField("node", chalk.green(snapshot.app.nodeVersion)));
  lines.push(renderField("platform", chalk.green(snapshot.app.platform)));
  lines.push("");

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
  lines.push(renderPathField("state dir", snapshot.runtime.stateDir));
  lines.push(renderPathField("config path", snapshot.runtime.configPath));
  lines.push(renderPathField("pid file", snapshot.runtime.pidFile));
  lines.push(renderPathField("log file", snapshot.runtime.logFile));
  lines.push(renderPathField("db path", snapshot.runtime.dbPath));
  lines.push(renderPathField("transcripts", snapshot.runtime.transcriptDir));
  lines.push(renderField("db size", chalk.green(formatBytes(snapshot.runtime.dbSizeBytes))));
  lines.push(renderField("log size", chalk.green(formatBytes(snapshot.runtime.logSizeBytes))));
  lines.push(renderField("transcript files", chalk.yellow(String(snapshot.runtime.transcriptFileCount))));
  lines.push(renderField("skills loaded", chalk.yellow(String(snapshot.runtime.skillsCount))));
  for (const [index, skillsDir] of snapshot.runtime.skillsDirs.entries()) {
    lines.push(renderPathField(`skills dir ${index + 1}`, skillsDir));
  }
  lines.push("");

  lines.push(sectionTitle("Discord"));
  lines.push(renderField("token", colorBoolean(snapshot.discord.tokenConfigured)));
  lines.push(renderField("allowed users", chalk.yellow(String(snapshot.discord.allowedUsers))));
  lines.push(renderField("allowed guilds", chalk.yellow(String(snapshot.discord.allowedGuilds))));
  lines.push(renderField("access mode", chalk.green(snapshot.discord.accessMode)));
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
  lines.push(
    renderField(
      "credential type",
      snapshot.model.credentialType ? chalk.green(snapshot.model.credentialType) : chalk.dim("-"),
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

export function renderStatusPlainText(snapshot: StatusSnapshot): string {
  const lines: string[] = [];
  lines.push("ClawNeo Status", "");

  lines.push("App");
  lines.push(`- version: ${snapshot.app.version}`);
  lines.push(`- node: ${snapshot.app.nodeVersion}`);
  lines.push(`- platform: ${snapshot.app.platform}`);
  lines.push("");

  lines.push("Process");
  lines.push(`- running: ${snapshot.process.running ? "yes" : "no"}`);
  lines.push(`- pid: ${snapshot.process.pid ?? "-"}`);
  lines.push(
    `- uptime: ${
      snapshot.process.uptimeMs ? formatDuration(snapshot.process.uptimeMs) : "-"
    }`,
  );
  lines.push("");

  lines.push("Runtime");
  lines.push(`- state dir: ${snapshot.runtime.stateDir}`);
  lines.push(`- config path: ${snapshot.runtime.configPath}`);
  lines.push(`- pid file: ${snapshot.runtime.pidFile}`);
  lines.push(`- log file: ${snapshot.runtime.logFile}`);
  lines.push(`- db path: ${snapshot.runtime.dbPath}`);
  lines.push(`- transcripts: ${snapshot.runtime.transcriptDir}`);
  lines.push(`- db size: ${formatBytes(snapshot.runtime.dbSizeBytes)}`);
  lines.push(`- log size: ${formatBytes(snapshot.runtime.logSizeBytes)}`);
  lines.push(`- transcript files: ${snapshot.runtime.transcriptFileCount}`);
  lines.push(`- skills loaded: ${snapshot.runtime.skillsCount}`);
  for (const [index, skillsDir] of snapshot.runtime.skillsDirs.entries()) {
    lines.push(`- skills dir ${index + 1}: ${skillsDir}`);
  }
  lines.push("");

  lines.push("Discord");
  lines.push(`- token: ${snapshot.discord.tokenConfigured ? "yes" : "no"}`);
  lines.push(`- allowed users: ${snapshot.discord.allowedUsers}`);
  lines.push(`- allowed guilds: ${snapshot.discord.allowedGuilds}`);
  lines.push(`- access mode: ${snapshot.discord.accessMode}`);
  lines.push("");

  lines.push("Model");
  lines.push(`- model: ${snapshot.model.model}`);
  lines.push(`- default profile: ${snapshot.model.defaultProfileId ?? "-"}`);
  lines.push(`- profiles: ${snapshot.model.oauthProfileCount}`);
  lines.push(`- auth usable: ${snapshot.model.authUsable ? "yes" : "no"}`);
  lines.push(
    `- token expired: ${
      snapshot.model.tokenExpired === null ? "-" : snapshot.model.tokenExpired ? "yes" : "no"
    }`,
  );
  lines.push(`- credential type: ${snapshot.model.credentialType ?? "-"}`);
  lines.push(`- auth store: ${snapshot.model.authStore}`);
  lines.push("");

  lines.push("Recent log tail");
  if (snapshot.logs.length === 0) {
    lines.push("- (no log lines)");
  } else {
    for (const line of snapshot.logs) {
      lines.push(`- ${line}`);
    }
  }

  return lines.join("\n");
}
