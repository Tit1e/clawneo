import fs from "node:fs";
import { spawn } from "node:child_process";
import process from "node:process";
import chalk from "chalk";
import {
  ensureDataDir,
  ensureFreshPidState,
  readPid,
  removePidFile,
  resolveLogPath,
  writePid,
} from "./status.js";

export function startService(): { started: boolean; pid: number | null; logPath: string | null } {
  const runningPid = ensureFreshPidState();
  if (runningPid) {
    console.log(`${chalk.yellow("MiniClaw is already running")} ${chalk.dim(`(pid ${runningPid})`)}.`);
    return { started: false, pid: runningPid, logPath: null };
  }

  ensureDataDir();
  const logPath = resolveLogPath();
  const stdoutFd = fs.openSync(logPath, "a");
  const stderrFd = fs.openSync(logPath, "a");
  const child = spawn(process.execPath, [...process.execArgv, "src/cli/run-main.ts", "serve"], {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", stdoutFd, stderrFd],
    env: process.env,
  });

  if (!child.pid) {
    throw new Error("Failed to determine MiniClaw child process id.");
  }

  writePid(child.pid);
  child.unref();
  fs.closeSync(stdoutFd);
  fs.closeSync(stderrFd);

  console.log(`${chalk.green("MiniClaw started")} ${chalk.dim(`(pid ${child.pid})`)}.`);
  console.log(`${chalk.bold("Log:")} ${chalk.dim(logPath)}`);
  return { started: true, pid: child.pid, logPath };
}

export function stopService(): { stopped: boolean; pid: number | null } {
  const runningPid = ensureFreshPidState();
  if (!runningPid) {
    console.log(chalk.yellow("MiniClaw is not running."));
    return { stopped: false, pid: null };
  }

  process.kill(runningPid, "SIGTERM");
  removePidFile();
  console.log(`${chalk.green("MiniClaw stopped")} ${chalk.dim(`(pid ${runningPid})`)}.`);
  return { stopped: true, pid: runningPid };
}

export function restartService(): void {
  stopService();
  startService();
}

export function runDetachedServiceCommand(command: "stop" | "restart"): void {
  const child = spawn(process.execPath, [...process.execArgv, "src/cli/run-main.ts", command], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
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
