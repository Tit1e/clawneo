import process from "node:process";
import chalk from "chalk";
import { runApp } from "../app.js";
import {
  collectStatusSnapshot,
  renderStatusText,
} from "./status.js";
import { runUiServer } from "../ui/server.js";
import { runConfigCommand } from "./config.js";
import { registerServeProcessLifecycle, restartService, startService, stopService } from "./service-manager.js";

type CliCommand = "start" | "stop" | "restart" | "status" | "ui" | "serve" | "config";

function printUsage(): void {
  console.log(`${chalk.bold("Usage:")} miniclaw <start|stop|restart|status|ui|config>`);
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
  registerServeProcessLifecycle();
  await runApp();
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
    startService();
    return;
  }

  if (command === "stop") {
    stopService();
    return;
  }

  if (command === "restart") {
    restartService();
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

  if (command === "config") {
    await runConfigCommand();
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
