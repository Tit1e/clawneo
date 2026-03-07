import fs from "node:fs";
import process from "node:process";
import { spawn } from "node:child_process";
import chalk from "chalk";
import { runApp } from "../app.js";
import {
  collectStatusSnapshot,
  ensureDataDir,
  ensureFreshPidState,
  removePidFile,
  renderStatusText,
  resolveLogPath,
  readPid,
  resolvePidPath,
  writePid,
} from "./status.js";
import { runUiServer } from "../ui/server.js";

type CliCommand = "start" | "stop" | "restart" | "status" | "ui" | "serve";

function printUsage(): void {
  console.log(`${chalk.bold("Usage:")} miniclaw <start|stop|restart|status|ui>`);
}

function statusCommand(jsonMode: boolean): void {
  const snapshot = collectStatusSnapshot();
  if (jsonMode) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log(renderStatusText(snapshot));
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
    console.log(`${chalk.yellow("MiniClaw is already running")} ${chalk.dim(`(pid ${runningPid})`)}.`);
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

  console.log(`${chalk.green("MiniClaw started")} ${chalk.dim(`(pid ${child.pid})`)}.`);
  console.log(`${chalk.bold("Log:")} ${chalk.dim(logPath)}`);
}

function stopCommand(): void {
  const runningPid = ensureFreshPidState();
  if (!runningPid) {
    console.log(chalk.yellow("MiniClaw is not running."));
    return;
  }

  process.kill(runningPid, "SIGTERM");
  removePidFile();
  console.log(`${chalk.green("MiniClaw stopped")} ${chalk.dim(`(pid ${runningPid})`)}.`);
}

function restartCommand(): void {
  stopCommand();
  startCommand();
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const command = (argv[2]?.trim().toLowerCase() || "start") as CliCommand;
  const jsonMode = argv.includes("--json");
  const portArgIndex = argv.indexOf("--port");
  const port =
    portArgIndex !== -1 && argv[portArgIndex + 1]
      ? Number.parseInt(argv[portArgIndex + 1] as string, 10)
      : 3210;

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

  if (command === "status") {
    statusCommand(jsonMode);
    return;
  }

  if (command === "ui") {
    await runUiServer(Number.isFinite(port) && port > 0 ? port : 3210);
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
