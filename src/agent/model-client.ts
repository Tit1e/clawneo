import type { AppConfig, ModelReplyResult, StoredMessage } from "../core/types.js";
import { generateAgentReply } from "./pi-agent-runtime.js";

type GenerateReplyParams = {
  config: AppConfig;
  systemPrompt: string;
  transcript: StoredMessage[];
  sessionKey: string;
};

export async function generateModelReply({
  config,
  systemPrompt,
  transcript,
  sessionKey,
}: GenerateReplyParams): Promise<ModelReplyResult> {
  return generateAgentReply({
    config,
    systemPrompt,
    transcript,
    sessionKey,
  });
}
