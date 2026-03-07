import fs from "node:fs";
import path from "node:path";
import type { AuthProfileCredential, AuthProfileStore } from "./types.js";

const AUTH_STORE_VERSION = 1;

function createEmptyStore(): AuthProfileStore {
  return {
    version: AUTH_STORE_VERSION,
    profiles: {},
    defaultProfileId: undefined,
  };
}

export function ensureAuthStore(storePath: string): AuthProfileStore {
  if (!fs.existsSync(storePath)) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    const empty = createEmptyStore();
    fs.writeFileSync(storePath, `${JSON.stringify(empty, null, 2)}\n`);
    return empty;
  }

  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AuthProfileStore>;
    if (parsed.version !== AUTH_STORE_VERSION || !parsed.profiles || typeof parsed.profiles !== "object") {
      return createEmptyStore();
    }
    return {
      version: AUTH_STORE_VERSION,
      profiles: parsed.profiles as Record<string, AuthProfileCredential>,
      defaultProfileId:
        typeof parsed.defaultProfileId === "string" && parsed.defaultProfileId.trim()
          ? parsed.defaultProfileId
          : undefined,
    };
  } catch {
    return createEmptyStore();
  }
}

export function saveAuthStore(storePath: string, store: AuthProfileStore): void {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`);
}

export function buildOpenAICodexProfileId(identity?: string): string {
  return `openai-codex:${identity?.trim() || "default"}`;
}

export function upsertAuthProfile(params: {
  storePath: string;
  profileId: string;
  credential: AuthProfileCredential;
}): void {
  const store = ensureAuthStore(params.storePath);
  store.profiles[params.profileId] = params.credential;
  store.defaultProfileId = params.profileId;
  saveAuthStore(params.storePath, store);
}

export function listProfilesForProvider(
  store: AuthProfileStore,
  provider: AuthProfileCredential["provider"],
): string[] {
  return Object.entries(store.profiles)
    .filter(([, credential]) => credential.provider === provider)
    .map(([profileId]) => profileId)
    .sort((a, b) => {
      const aIsLegacyDefault = a === "openai-codex:default";
      const bIsLegacyDefault = b === "openai-codex:default";
      if (aIsLegacyDefault !== bIsLegacyDefault) {
        return aIsLegacyDefault ? 1 : -1;
      }
      return a.localeCompare(b);
    });
}

export function resolveDefaultOpenAICodexProfile(store: AuthProfileStore): {
  profileId: string;
  credential: AuthProfileCredential;
} | null {
  const explicitProfileId = store.defaultProfileId;
  if (explicitProfileId) {
    const explicitCredential = store.profiles[explicitProfileId];
    if (explicitCredential?.provider === "openai-codex") {
      return {
        profileId: explicitProfileId,
        credential: explicitCredential,
      };
    }
  }

  const profileId = listProfilesForProvider(store, "openai-codex")[0];
  if (!profileId) {
    return null;
  }
  const credential = store.profiles[profileId];
  if (!credential) {
    return null;
  }
  return { profileId, credential };
}
