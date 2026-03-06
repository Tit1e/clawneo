import { execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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

function computeCodexKeychainAccount(codexHome: string): string {
  const hash = crypto.createHash("sha256").update(codexHome).digest("hex");
  return `cli|${hash.slice(0, 16)}`;
}

function readCodexKeychainCredential(): CodexCliCredential | null {
  if (process.platform !== "darwin") {
    return null;
  }

  try {
    const account = computeCodexKeychainAccount(resolveCodexHomePath());
    const secret = execSync(
      `security find-generic-password -s "Codex Auth" -a "${account}" -w`,
      {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();
    const parsed = JSON.parse(secret) as Record<string, unknown>;
    const tokens = parsed.tokens as Record<string, unknown> | undefined;
    const access = tokens?.access_token;
    const refresh = tokens?.refresh_token;
    const accountId = typeof tokens?.account_id === "string" ? tokens.account_id : undefined;
    if (typeof access !== "string" || !access || typeof refresh !== "string" || !refresh) {
      return null;
    }

    const lastRefreshRaw = parsed.last_refresh;
    const lastRefresh =
      typeof lastRefreshRaw === "string" || typeof lastRefreshRaw === "number"
        ? new Date(lastRefreshRaw).getTime()
        : Date.now();

    return {
      access,
      refresh,
      expires: Number.isFinite(lastRefresh) ? lastRefresh + 60 * 60 * 1000 : Date.now() + 60 * 60 * 1000,
      accountId,
    };
  } catch {
    return null;
  }
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

function readLocalCodexCliCredential(): CodexCliCredential | null {
  return readCodexKeychainCredential() || readCodexFileCredential();
}

function syncLocalCodexCredential(config: AppConfig): CodexCliCredential | null {
  const localCredential = readLocalCodexCliCredential();
  if (!localCredential) {
    return null;
  }

  const profileId = buildOpenAICodexProfileId(localCredential.email);
  upsertAuthProfile({
    storePath: config.runtime.authStorePath,
    profileId,
    credential: {
      type: "oauth",
      provider: "openai-codex",
      access: localCredential.access,
      refresh: localCredential.refresh,
      expires: localCredential.expires,
      email: localCredential.email,
    },
  });

  return localCredential;
}

export function normalizeOpenAICodexModel(model: string): string {
  const trimmed = model.trim();
  if (trimmed.toLowerCase().startsWith("openai-codex/")) {
    return trimmed.slice("openai-codex/".length);
  }
  return trimmed || "gpt-5.4";
}

export async function loginWithOpenAICodexOAuth(config: AppConfig): Promise<string> {
  const credential = syncLocalCodexCredential(config);
  if (!credential) {
    throw new Error(
      [
        "No local Codex OAuth credential was found.",
        "Please sign in with the Codex CLI or desktop client first, then rerun `npm run auth:login`.",
        `Checked: ${resolveCodexAuthPath()}${process.platform === "darwin" ? ' and macOS keychain service "Codex Auth"' : ""}.`,
      ].join("\n"),
    );
  }

  const profileId = buildOpenAICodexProfileId(credential.email);
  console.log(`Saved auth profile: ${profileId}`);
  console.log("Source: local Codex OAuth credential");
  return profileId;
}

export async function resolveOpenAICodexCredential(config: AppConfig): Promise<AuthProfileCredential> {
  const localCredential = syncLocalCodexCredential(config);
  if (localCredential) {
    if (Date.now() >= localCredential.expires) {
      console.warn(
        `[auth] local Codex OAuth credential looks expired; using cached access token fallback for ${buildOpenAICodexProfileId(localCredential.email)}`,
      );
    }
    return {
      type: "oauth",
      provider: "openai-codex",
      access: localCredential.access,
      refresh: localCredential.refresh,
      expires: localCredential.expires,
      email: localCredential.email,
    };
  }

  const store = ensureAuthStore(config.runtime.authStorePath);
  const resolved = resolveDefaultOpenAICodexProfile(store);
  if (!resolved) {
    throw new Error('No OpenAI Codex OAuth profile found. Run "npm run auth:login" first.');
  }

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

  console.warn(
    `[auth] stored Codex OAuth profile looks expired; using cached access token fallback for ${profileId}`,
  );
  return credential;
}

export async function resolveOpenAICodexAccessToken(config: AppConfig): Promise<string> {
  const credential = await resolveOpenAICodexCredential(config);
  if (credential.type === "token") {
    return credential.token;
  }
  return credential.access;
}
