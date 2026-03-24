import { completeSimple, type Api, type AssistantMessage, type Context, type Model } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { resolveOpenAICodexCredential } from "../auth/openai-codex-oauth.js";
import type { AuthProfileCredential } from "../auth/types.js";
import type { AppConfig, StoredMessage } from "../core/types.js";

const DEFAULT_CONTEXT_TOKENS = 272000;

function createUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function buildContext(model: Model<Api>, systemPrompt: string, transcript: StoredMessage[]): Context {
  const messages: Context["messages"] = [];

  for (const entry of transcript) {
    if (entry.role === "user") {
      messages.push({
        role: "user",
        content: entry.content,
        timestamp: toTimestamp(entry.createdAt),
      });
      continue;
    }

    if (entry.role === "assistant") {
      messages.push({
        role: "assistant",
        content: [{ type: "text", text: entry.content }],
        api: model.api,
        provider: model.provider,
        model: model.id,
        usage: createUsage(),
        stopReason: "stop",
        timestamp: toTimestamp(entry.createdAt),
      });
    }
  }

  return {
    systemPrompt: systemPrompt.trim() || undefined,
    messages,
  };
}

function extractAssistantText(message: AssistantMessage): string {
  return message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function resolveModelId(rawModel: string, credential: AuthProfileCredential): { provider: string; modelId: string } {
  const trimmed = rawModel.trim();
  if (!trimmed) {
    return {
      provider: credential.type === "token" ? "openai" : "openai-codex",
      modelId: "gpt-5.4",
    };
  }

  const separatorIndex = trimmed.indexOf("/");
  if (separatorIndex <= 0) {
    return {
      provider: credential.type === "token" ? "openai" : "openai-codex",
      modelId: trimmed,
    };
  }

  const rawProvider = trimmed.slice(0, separatorIndex).trim();
  return {
    provider:
      credential.type === "token"
        ? (rawProvider === "openai-codex" ? "openai" : rawProvider || "openai")
        : rawProvider || "openai-codex",
    modelId: trimmed.slice(separatorIndex + 1).trim() || "gpt-5.4",
  };
}

function resolveModel(
  modelRegistry: ModelRegistry,
  rawModel: string,
  baseUrl: string,
  credential: AuthProfileCredential,
): Model<Api> {
  const { provider, modelId } = resolveModelId(rawModel, credential);
  const discovered = modelRegistry.find(provider, modelId);
  if (discovered) {
    return {
      ...discovered,
      baseUrl: baseUrl || discovered.baseUrl,
    };
  }

  if (credential.type === "token") {
    if (provider !== "openai") {
      throw new Error(`Unsupported provider "${provider}". API Key mode currently only supports openai.`);
    }
    return {
      id: modelId,
      name: modelId,
      api: "openai-responses",
      provider,
      baseUrl,
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: DEFAULT_CONTEXT_TOKENS,
      maxTokens: DEFAULT_CONTEXT_TOKENS,
    };
  }

  if (provider !== "openai-codex") {
    throw new Error(`Unsupported provider "${provider}". ClawNeo currently only supports openai-codex.`);
  }

  return {
    id: modelId,
    name: modelId,
    api: "openai-codex-responses",
    provider,
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT_TOKENS,
    maxTokens: DEFAULT_CONTEXT_TOKENS,
  };
}

export async function generatePiCodexReply(params: {
  config: AppConfig;
  systemPrompt: string;
  transcript: StoredMessage[];
  sessionKey: string;
}): Promise<string> {
  const credential = await resolveOpenAICodexCredential(params.config);
  const authStorage = AuthStorage.inMemory({
    ...(credential.type === "oauth"
      ? {
          "openai-codex": {
            type: "oauth" as const,
            access: credential.access,
            refresh: credential.refresh,
            expires: credential.expires,
          },
        }
      : {
          openai: {
            type: "api_key" as const,
            key: credential.token,
          },
          "openai-codex": {
            type: "api_key" as const,
            key: credential.token,
          },
        }),
  });
  const modelRegistry = new ModelRegistry(authStorage);
  const model = resolveModel(
    modelRegistry,
    params.config.agent.model,
    params.config.agent.baseUrl,
    credential,
  );
  const apiKey = await modelRegistry.getApiKey(model);
  if (!apiKey) {
    throw new Error("Unable to resolve an API credential for the configured model.");
  }

  const useMinimalApiKeyContext = credential.type === "token";
  const context = useMinimalApiKeyContext
    ? {
        messages: params.transcript
          .filter((entry) => entry.role === "user")
          .slice(-1)
          .map((entry) => ({
            role: "user" as const,
            content: entry.content,
            timestamp: toTimestamp(entry.createdAt),
          })),
      }
    : buildContext(model, params.systemPrompt, params.transcript);
  const requestOptions = {
    apiKey,
    transport: "auto" as const,
    ...(useMinimalApiKeyContext ? {} : { sessionId: params.sessionKey }),
  };

  const message = await completeSimple(model, context, requestOptions);
  const text = extractAssistantText(message);
  if (!text) {
    throw new Error("Codex response did not contain text output.");
  }
  return text;
}
