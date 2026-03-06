import {
  AuthStorage,
  createAgentSession,
  createBashTool,
  createExtensionRuntime,
  createGrepTool,
  createLsTool,
  createReadTool,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSessionEvent,
  type ResourceLoader,
} from "@mariozechner/pi-coding-agent";
import type { Api, Model } from "@mariozechner/pi-ai";
import { resolveOpenAICodexCredential } from "../auth/openai-codex-oauth.js";
import type { AppConfig, ModelReplyResult, StoredMessage, ToolExecutionRecord } from "../core/types.js";
import { createSecureBashOperations } from "../tools/secure-bash.js";

const DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
const DEFAULT_CONTEXT_TOKENS = 272000;

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
    throw new Error(`Unsupported provider "${provider}". MiniClaw currently only supports openai-codex.`);
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

function serializeTranscriptHistory(transcript: StoredMessage[]): string {
  const history = transcript.slice(0, -1);
  if (history.length === 0) {
    return "";
  }
  return history
    .map((entry) => {
      const role = entry.role === "assistant" ? "Assistant" : entry.role === "tool" ? "Tool" : "User";
      return `${role}: ${entry.content}`;
    })
    .join("\n\n");
}

function buildResourceLoader(systemPrompt: string, transcript: StoredMessage[]): ResourceLoader {
  const historyText = serializeTranscriptHistory(transcript);
  const combinedPrompt = [
    systemPrompt.trim(),
    historyText
      ? [
          "Recent conversation history:",
          historyText,
          "Use the history as context, but answer the latest user message directly.",
        ].join("\n\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => combinedPrompt,
    getAppendSystemPrompt: () => [],
    getPathMetadata: () => new Map(),
    extendResources: () => {},
    reload: async () => {},
  };
}

function extractLatestUserPrompt(transcript: StoredMessage[]): string {
  const latest = transcript[transcript.length - 1];
  if (!latest || latest.role !== "user") {
    throw new Error("Expected the latest transcript entry to be the current user message.");
  }
  return latest.content;
}

function extractReply(sessionMessages: Array<{ role: string; content?: unknown }>): string {
  const latestAssistant = [...sessionMessages]
    .reverse()
    .find((message) => message.role === "assistant") as
    | { role: "assistant"; content?: Array<{ type?: string; text?: string }> }
    | undefined;

  if (!latestAssistant || !Array.isArray(latestAssistant.content)) {
    throw new Error("Agent session did not produce an assistant message.");
  }

  const text = latestAssistant.content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text!.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("Agent session did not produce text output.");
  }
  return text;
}

function toToolRecord(event: AgentSessionEvent): ToolExecutionRecord | null {
  if (event.type !== "tool_execution_end") {
    return null;
  }

  let content = "";
  if (typeof event.result === "string") {
    content = event.result;
  } else {
    try {
      content = JSON.stringify(event.result);
    } catch {
      content = String(event.result);
    }
  }

  return {
    toolName: event.toolName,
    content,
    isError: Boolean(event.isError),
  };
}

export async function generateAgentReply(params: {
  config: AppConfig;
  systemPrompt: string;
  transcript: StoredMessage[];
  sessionKey: string;
}): Promise<ModelReplyResult> {
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

  const resourceLoader = buildResourceLoader(params.systemPrompt, params.transcript);
  const { session } = await createAgentSession({
    cwd: params.config.agent.toolCwd,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: "medium",
    resourceLoader,
    tools: [
      createReadTool(params.config.agent.toolCwd),
      createLsTool(params.config.agent.toolCwd),
      createGrepTool(params.config.agent.toolCwd),
      createBashTool(params.config.agent.toolCwd, {
        operations: createSecureBashOperations(),
      }),
    ],
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 2 },
    }),
  });

  const toolEvents: ToolExecutionRecord[] = [];
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "tool_execution_start") {
      console.log(
        `[tools] start session=${params.sessionKey} tool=${event.toolName} args=${JSON.stringify(event.args ?? null)}`,
      );
    }
    const toolRecord = toToolRecord(event);
    if (toolRecord) {
      console.log(
        `[tools] end session=${params.sessionKey} tool=${toolRecord.toolName} isError=${String(toolRecord.isError)} result=${JSON.stringify(toolRecord.content)}`,
      );
      toolEvents.push(toolRecord);
    }
  });

  try {
    await session.prompt(extractLatestUserPrompt(params.transcript));
    return {
      reply: extractReply(session.state.messages),
      toolEvents,
    };
  } finally {
    unsubscribe();
    session.dispose();
  }
}

export async function executeApprovedCommand(params: {
  config: AppConfig;
  command: string;
}): Promise<{ exitCode: number | null; output: string }> {
  throw new Error(`executeApprovedCommand is disabled: ${params.command} @ ${params.config.agent.toolCwd}`);
}
