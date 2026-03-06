import type { AppConfig, StoredMessage } from "../core/types.js";
import { generatePiCodexReply } from "./pi-codex-runtime.js";

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
}: GenerateReplyParams): Promise<string> {
  return generatePiCodexReply({
    config,
    systemPrompt,
    transcript,
    sessionKey,
  });
}
