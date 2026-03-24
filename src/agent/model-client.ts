import type { AppConfig, ModelReplyResult, StoredMessage, ToolRequestContext } from "../core/types.js";
import type { ScheduledTaskStore } from "../scheduled-tasks/store.js";
import { generateAgentReply } from "./pi-agent-runtime.js";
import { generatePiCodexReply } from "./pi-codex-runtime.js";

type GenerateReplyParams = {
  config: AppConfig;
  systemPrompt: string;
  transcript: StoredMessage[];
  sessionKey: string;
  context: ToolRequestContext;
  scheduledTaskStore: ScheduledTaskStore;
  signal?: AbortSignal;
};

export async function generateModelReply({
  config,
  systemPrompt,
  transcript,
  sessionKey,
  context,
  scheduledTaskStore,
  signal,
}: GenerateReplyParams): Promise<ModelReplyResult> {
  if (config.agent.apiKey.trim()) {
    const reply = await generatePiCodexReply({
      config,
      systemPrompt,
      transcript,
      sessionKey,
    });
    return {
      reply,
      toolEvents: [],
    };
  }

  return generateAgentReply({
    config,
    systemPrompt,
    transcript,
    sessionKey,
    context,
    scheduledTaskStore,
    signal,
  });
}
