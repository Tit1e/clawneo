import fs from "node:fs";
import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import {
  ensureDataDir,
  ensureFreshPidState,
  readPid,
  removePidFile,
  resolveLogPath,
  writePid,
} from "./status.js";

function resolveCliEntrypoint(): string[] {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const distEntry = path.join(currentDir, "run-main.js");
  if (fs.existsSync(distEntry)) {
    return [...process.execArgv, distEntry];
  }
  const srcEntry = path.resolve(currentDir, "run-main.ts");
  return [...process.execArgv, srcEntry];
}

export function startService(): { started: boolean; pid: number | null; logPath: string | null } {
  const runningPid = ensureFreshPidState();
  if (runningPid) {
    console.log(`${chalk.yellow("ClawNeo is already running")} ${chalk.dim(`(pid ${runningPid})`)}.`);
    return { started: false, pid: runningPid, logPath: null };
  }

  ensureDataDir();
  const logPath = resolveLogPath();
  const stdoutFd = fs.openSync(logPath, "a");
  const stderrFd = fs.openSync(logPath, "a");
  const child = spawn(process.execPath, [...resolveCliEntrypoint(), "serve"], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", stdoutFd, stderrFd],
    env: process.env,
  });

  if (!child.pid) {
    throw new Error("Failed to determine ClawNeo child process id.");
  }

  writePid(child.pid);
  child.unref();
  fs.closeSync(stdoutFd);
  fs.closeSync(stderrFd);

  console.log(`${chalk.green("ClawNeo started")} ${chalk.dim(`(pid ${child.pid})`)}.`);
  console.log(`${chalk.bold("Log:")} ${chalk.dim(logPath)}`);
  return { started: true, pid: child.pid, logPath };
}

export function stopService(): { stopped: boolean; pid: number | null } {
  const runningPid = ensureFreshPidState();
  if (!runningPid) {
    console.log(chalk.yellow("ClawNeo is not running."));
    return { stopped: false, pid: null };
  }

  process.kill(runningPid, "SIGTERM");
  removePidFile();
  console.log(`${chalk.green("ClawNeo stopped")} ${chalk.dim(`(pid ${runningPid})`)}.`);
  return { stopped: true, pid: runningPid };
}

export function restartService(): void {
  stopService();
  startService();
}

function resolveShellCommand(): string {
  const candidates = [process.env.SHELL, "/bin/zsh", "/bin/bash", "/bin/sh"].filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return "sh";
}

export function runDetachedServiceCommand(command: "stop" | "restart"): void {
  const child = spawn(process.execPath, [...resolveCliEntrypoint(), command], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
}

export function runDetachedUpdateCommand(): void {
  const shell = resolveShellCommand();
  const child = spawn(
    shell,
    ["-lc", "npm install -g clawneo@latest && clawneo restart"],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: process.env,
    },
  );
  child.unref();
}

export function isServiceRunning(): boolean {
  return Boolean(ensureFreshPidState());
}

export function registerServeProcessLifecycle(): void {
  ensureDataDir();
  writePid(process.pid);

  const cleanup = () => {
    const currentPid = readPid();
    if (currentPid === process.pid) {
      removePidFile();
    }
  };

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
  process.on("exit", cleanup);
}
