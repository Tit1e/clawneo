import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { loginOpenAICodex, refreshOpenAICodexToken } from "@mariozechner/pi-ai";
import type { AppConfig } from "../core/types.js";
import {
  buildOpenAICodexProfileId,
  ensureAuthStore,
  resolveDefaultOpenAICodexProfile,
  upsertAuthProfile,
} from "./store.js";
import type { AuthProfileCredential } from "./types.js";

type CodexCliCredential = {
  access: string;
  refresh: string;
  expires: number;
  accountId?: string;
  email?: string;
};

function resolveCodexHomePath(): string {
  const configured = process.env.CODEX_HOME?.trim();
  const home = configured
    ? path.resolve(configured)
    : path.join(process.env.HOME || process.cwd(), ".codex");
  try {
    return fs.realpathSync.native(home);
  } catch {
    return home;
  }
}

function resolveCodexAuthPath(): string {
  return path.join(resolveCodexHomePath(), "auth.json");
}

function readCodexFileCredential(): CodexCliCredential | null {
  const authPath = resolveCodexAuthPath();
  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(authPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const tokens = parsed.tokens as Record<string, unknown> | undefined;
    const access = tokens?.access_token;
    const refresh = tokens?.refresh_token;
    const accountId = typeof tokens?.account_id === "string" ? tokens.account_id : undefined;
    if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
      return null;
    }

    const stat = fs.statSync(authPath);
    return {
      access,
      refresh,
      expires: stat.mtimeMs + 60 * 60 * 1000,
      accountId,
    };
  } catch {
    return null;
  }
}

function openAuthUrl(url: string): void {
  try {
    if (process.platform === "darwin") {
      execSync(`open ${JSON.stringify(url)}`, {
        stdio: "ignore",
        timeout: 5000,
      });
      return;
    }

    if (process.platform === "linux") {
      execSync(`xdg-open ${JSON.stringify(url)}`, {
        stdio: "ignore",
        timeout: 5000,
      });
      return;
    }

    if (process.platform === "win32") {
      execSync(`start "" ${JSON.stringify(url)}`, {
        stdio: "ignore",
        timeout: 5000,
        shell: "cmd.exe",
      });
    }
  } catch {
    // Ignore browser-open failures. The URL is still printed to the terminal.
  }
}

function isNodeRuntimeBootstrapError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("only available in Node.js environments");
}

async function loginWithRetry(): Promise<Awaited<ReturnType<typeof loginOpenAICodex>>> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await loginOpenAICodex({
        originator: "clawneo",
        onAuth: ({ url, instructions }) => {
          console.log("OpenAI Codex OAuth started.");
          if (instructions) {
            console.log(instructions);
          }
          console.log(`Auth URL: ${url}`);
          openAuthUrl(url);
        },
        onProgress: (message) => {
          console.log(`[auth] ${message}`);
        },
        onPrompt: async (prompt) => promptForInput(prompt.message),
      });
    } catch (error) {
      lastError = error;
      if (!isNodeRuntimeBootstrapError(error) || attempt === 4) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function promptForInput(message: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error(`${message}\nClawNeo is running in a non-interactive terminal, so paste fallback is unavailable.`);
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(`${message}\n> `)).trim();
  } finally {
    rl.close();
  }
}

function persistCredential(config: AppConfig, credential: {
  access: string;
  refresh: string;
  expires: number;
  accountId?: string;
  email?: string;
}): { profileId: string; stored: AuthProfileCredential } {
  const profileId = buildOpenAICodexProfileId(credential.email || credential.accountId);
  const stored: AuthProfileCredential = {
    type: "oauth",
    provider: "openai-codex",
    access: credential.access,
    refresh: credential.refresh,
    expires: credential.expires,
    email: credential.email,
    accountId: credential.accountId,
  };

  upsertAuthProfile({
    storePath: config.runtime.authStorePath,
    profileId,
    credential: stored,
  });

  return { profileId, stored };
}

function syncLocalCodexCredential(config: AppConfig): { profileId: string; stored: AuthProfileCredential } | null {
  const localCredential = readCodexFileCredential();
  if (!localCredential) {
    return null;
  }
  return persistCredential(config, localCredential);
}

export function normalizeOpenAICodexModel(model: string): string {
  const trimmed = model.trim();
  if (trimmed.toLowerCase().startsWith("openai-codex/")) {
    return trimmed.slice("openai-codex/".length);
  }
  return trimmed || "gpt-5.4";
}

export async function loginWithOpenAICodexOAuth(config: AppConfig): Promise<string> {
  const credential = await loginWithRetry();

  const { profileId } = persistCredential(config, {
    access: credential.access,
    refresh: credential.refresh,
    expires: credential.expires,
    accountId: typeof credential.accountId === "string" ? credential.accountId : undefined,
  });

  console.log(`Saved auth profile: ${profileId}`);
  console.log("Source: OpenAI Codex OAuth");
  return profileId;
}

async function refreshStoredCredential(
  config: AppConfig,
  profileId: string,
  credential: Extract<AuthProfileCredential, { type: "oauth" }>,
): Promise<AuthProfileCredential> {
  try {
    const refreshed = await refreshOpenAICodexToken(credential.refresh);
    const { stored } = persistCredential(config, {
      access: refreshed.access,
      refresh: refreshed.refresh,
      expires: refreshed.expires,
      accountId: typeof refreshed.accountId === "string" ? refreshed.accountId : undefined,
      email: credential.email,
    });
    return stored;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Stored OAuth profile "${profileId}" could not be refreshed: ${message}. Re-run "npm run auth:login".`,
    );
  }
}

export async function resolveOpenAICodexCredential(config: AppConfig): Promise<AuthProfileCredential> {
  const store = ensureAuthStore(config.runtime.authStorePath);
  const resolved = resolveDefaultOpenAICodexProfile(store);
  if (resolved) {
    const { profileId, credential } = resolved;
    if (credential.type === "token") {
      if (credential.expires && Date.now() >= credential.expires) {
        throw new Error(`Stored token profile "${profileId}" is expired. Re-authenticate.`);
      }
      return credential;
    }

    if (Date.now() < credential.expires) {
      return credential;
    }

    console.warn(`[auth] refreshing expired Codex OAuth profile ${profileId}`);
    return refreshStoredCredential(config, profileId, credential);
  }

  const synced = syncLocalCodexCredential(config);
  if (synced) {
    console.warn(
      `[auth] no project OAuth profile found; imported local Codex credential from ${resolveCodexAuthPath()}`,
    );
    return synced.stored;
  }

  throw new Error('No OpenAI Codex OAuth profile found. Run "npm run auth:login" first.');
}

export async function resolveOpenAICodexAccessToken(config: AppConfig): Promise<string> {
  const credential = await resolveOpenAICodexCredential(config);
  if (credential.type === "token") {
    return credential.token;
  }
  return credential.access;
}
