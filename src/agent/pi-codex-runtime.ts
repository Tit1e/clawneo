import { completeSimple, type Api, type AssistantMessage, type Context, type Model } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { resolveOpenAICodexCredential } from "../auth/openai-codex-oauth.js";
import type { AppConfig, StoredMessage } from "../core/types.js";

const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
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

function resolveModelId(rawModel: string): { provider: string; modelId: string } {
  const trimmed = rawModel.trim();
  if (!trimmed) {
    return { provider: "openai-codex", modelId: "gpt-5.4" };
  }

  const separatorIndex = trimmed.indexOf("/");
  if (separatorIndex <= 0) {
    return { provider: "openai-codex", modelId: trimmed };
  }

  return {
    provider: trimmed.slice(0, separatorIndex).trim() || "openai-codex",
    modelId: trimmed.slice(separatorIndex + 1).trim() || "gpt-5.4",
  };
}

function resolveModel(modelRegistry: ModelRegistry, rawModel: string): Model<Api> {
  const { provider, modelId } = resolveModelId(rawModel);
  const discovered = modelRegistry.find(provider, modelId);
  if (discovered) {
    return discovered;
  }

  if (provider !== "openai-codex") {
    throw new Error(`Unsupported provider "${provider}". ClawNeo currently only supports openai-codex.`);
  }

  return {
    id: modelId,
    name: modelId,
    api: "openai-codex-responses",
    provider,
    baseUrl: DEFAULT_CODEX_BASE_URL,
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
    "openai-codex":
      credential.type === "oauth"
        ? {
            type: "oauth",
            access: credential.access,
            refresh: credential.refresh,
            expires: credential.expires,
          }
        : {
            type: "api_key",
            key: credential.token,
          },
  });
  const modelRegistry = new ModelRegistry(authStorage);
  const model = resolveModel(modelRegistry, params.config.agent.model);
  const apiKey = await modelRegistry.getApiKey(model);
  if (!apiKey) {
    throw new Error("Unable to resolve an OpenAI Codex access token from the configured OAuth profile.");
  }

  const message = await completeSimple(model, buildContext(model, params.systemPrompt, params.transcript), {
    apiKey,
    transport: "auto",
    sessionId: params.sessionKey,
  });
  const text = extractAssistantText(message);
  if (!text) {
    throw new Error("Codex response did not contain text output.");
  }
  return text;
}
