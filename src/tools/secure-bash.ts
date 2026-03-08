import fs from "node:fs";
import { spawn } from "node:child_process";
import type { BashOperations } from "@mariozechner/pi-coding-agent";

const DEFAULT_TIMEOUT_SECONDS = 30;
const MAX_TIMEOUT_SECONDS = 60;
const MAX_CAPTURE_BYTES = 64 * 1024;

const HARD_BLOCKED_PATTERNS: RegExp[] = [
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  /\bpoweroff\b/i,
  /\bmkfs(\.\w+)?\b/i,
  /\bfdisk\b/i,
  /\bdd\s+if=/i,
  /rm\s+-rf\s+\/($|\s)/i,
  /rm\s+-rf\s+--no-preserve-root/i,
  /:\(\)\s*\{\s*:\|:\s*&\s*\};:/,
];

function resolveShellExecutable(): string {
  if (process.platform === "win32") {
    throw new Error(
      "ClawNeo tool execution is not supported on Windows yet. The current shell tool requires a Unix shell.",
    );
  }

  const configuredShell = process.env.CLAWNEO_SHELL?.trim();
  if (configuredShell) {
    return configuredShell;
  }

  const candidates = [
    "/bin/zsh",
    "/usr/bin/zsh",
    "/bin/bash",
    "/usr/bin/bash",
    "/bin/sh",
    "/usr/bin/sh",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "sh";
}

function assertSafeCommand(command: string): void {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error("Refusing to execute an empty command.");
  }
  for (const pattern of HARD_BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error(`Blocked potentially dangerous command: ${trimmed}`);
    }
  }
}

function clampTimeoutSeconds(timeout?: number): number {
  if (!Number.isFinite(timeout) || !timeout || timeout <= 0) {
    return DEFAULT_TIMEOUT_SECONDS;
  }
  return Math.min(Math.max(1, timeout), MAX_TIMEOUT_SECONDS);
}

export async function runSecureBashCommand(params: {
  command: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
}): Promise<{ exitCode: number | null; output: string }> {
  const chunks: string[] = [];
  const operations = createSecureBashOperations();
  const result = await operations.exec(params.command, params.cwd, {
    onData: (data) => chunks.push(data.toString("utf8")),
    timeout: params.timeout,
    env: params.env ?? process.env,
  });
  return {
    exitCode: result.exitCode,
    output: chunks.join(""),
  };
}

export function createSecureBashOperations(): BashOperations {
  const shellExecutable = resolveShellExecutable();

  return {
    exec(command, cwd, { onData, signal, timeout, env }) {
      assertSafeCommand(command);
      const timeoutSeconds = clampTimeoutSeconds(timeout);

      return new Promise((resolve, reject) => {
        const child = spawn(shellExecutable, ["-lc", command], {
          cwd,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });

        const handleAbort = () => {
          child.kill("SIGTERM");
        };

        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) {
            return;
          }
          settled = true;
          signal?.removeEventListener("abort", handleAbort);
          fn();
        };

        const timeoutHandle = setTimeout(() => {
          child.kill("SIGTERM");
          finish(() => reject(new Error(`timeout:${timeoutSeconds}`)));
        }, timeoutSeconds * 1000);

        let capturedBytes = 0;
        let truncationNoticeSent = false;

        const handleData = (data: Buffer) => {
          if (capturedBytes >= MAX_CAPTURE_BYTES) {
            if (!truncationNoticeSent) {
              truncationNoticeSent = true;
              onData(Buffer.from(`\n[output truncated after ${MAX_CAPTURE_BYTES} bytes]\n`, "utf8"));
            }
            return;
          }

          const remainingBytes = MAX_CAPTURE_BYTES - capturedBytes;
          if (data.byteLength <= remainingBytes) {
            capturedBytes += data.byteLength;
            onData(data);
            return;
          }

          const partial = data.subarray(0, remainingBytes);
          capturedBytes += partial.byteLength;
          if (partial.byteLength > 0) {
            onData(partial);
          }
          if (!truncationNoticeSent) {
            truncationNoticeSent = true;
            onData(Buffer.from(`\n[output truncated after ${MAX_CAPTURE_BYTES} bytes]\n`, "utf8"));
          }
        };

        child.stdout.on("data", handleData);
        child.stderr.on("data", handleData);
        child.on("error", (error) => {
          clearTimeout(timeoutHandle);
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            finish(() =>
              reject(
                new Error(
                  `Shell executable not found: ${shellExecutable}. Set CLAWNEO_SHELL to a valid shell path.`,
                ),
              ),
            );
            return;
          }
          finish(() => reject(error));
        });
        child.on("close", (exitCode) => {
          clearTimeout(timeoutHandle);
          finish(() => resolve({ exitCode }));
        });

        if (signal) {
          if (signal.aborted) {
            clearTimeout(timeoutHandle);
            child.kill("SIGTERM");
            finish(() => reject(new Error("Request was aborted")));
            return;
          }
          signal.addEventListener("abort", handleAbort, { once: true });
        }
      });
    },
  };
}
