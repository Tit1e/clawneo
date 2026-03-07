import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { runApp } from "../app.js";

type CliCommand = "start" | "stop" | "restart" | "serve";

function resolveDataDir(): string {
  return path.resolve(process.cwd(), "data");
}

function resolvePidPath(): string {
  return path.join(resolveDataDir(), "miniclaw.pid");
}

function resolveLogPath(): string {
  return path.join(resolveDataDir(), "miniclaw.log");
}

function ensureDataDir(): void {
  fs.mkdirSync(resolveDataDir(), { recursive: true });
}

function readPid(): number | null {
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

function removePidFile(): void {
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

function isProcessRunning(pid: number): boolean {
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

function ensureFreshPidState(): number | null {
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

function writePid(pid: number): void {
  ensureDataDir();
  fs.writeFileSync(resolvePidPath(), `${pid}\n`, "utf8");
}

function printUsage(): void {
  console.log("Usage: miniclaw <start|stop|restart>");
}

async function runServeCommand(): Promise<void> {
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

  await runApp();
}

function startCommand(): void {
  const runningPid = ensureFreshPidState();
  if (runningPid) {
    console.log(`MiniClaw is already running (pid ${runningPid}).`);
    return;
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

  console.log(`MiniClaw started (pid ${child.pid}).`);
  console.log(`Log: ${logPath}`);
}

function stopCommand(): void {
  const runningPid = ensureFreshPidState();
  if (!runningPid) {
    console.log("MiniClaw is not running.");
    return;
  }

  process.kill(runningPid, "SIGTERM");
  removePidFile();
  console.log(`MiniClaw stopped (pid ${runningPid}).`);
}

function restartCommand(): void {
  stopCommand();
  startCommand();
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const command = (argv[2]?.trim().toLowerCase() || "start") as CliCommand;

  if (command === "serve") {
    await runServeCommand();
    return;
  }

  if (command === "start") {
    startCommand();
    return;
  }

  if (command === "stop") {
    stopCommand();
    return;
  }

  if (command === "restart") {
    restartCommand();
    return;
  }

  printUsage();
  process.exitCode = 1;
}

runCli().catch((error: unknown) => {
  console.error("MiniClaw CLI failed.");
  console.error(error);
  process.exitCode = 1;
});
