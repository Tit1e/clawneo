import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { generateModelReply } from "../agent/model-client.js";
import { buildPromptContext } from "./prompt-builder.js";
import { createSessionStore } from "./session-store.js";
import type { AppConfig, InboundMessage } from "./types.js";

type TranscriptStore = {
  append: (entry: {
    id: string;
    sessionKey: string;
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: unknown;
    createdAt?: string;
  }) => void;
};

type ConversationServiceParams = {
  config: AppConfig;
  db: DatabaseSync;
  transcriptStore: TranscriptStore;
};

export function createConversationService({
  config,
  db,
  transcriptStore,
}: ConversationServiceParams) {
  const sessionStore = createSessionStore(db);

  return {
    async handleMessage(message: InboundMessage): Promise<void> {
      sessionStore.ensureSession(message);

      transcriptStore.append({
        id: message.messageId,
        sessionKey: message.sessionKey,
        role: "user",
        content: message.text,
        createdAt: message.createdAt,
      });

      const preferences = sessionStore.listPreferences(message.userId);
      const transcript = sessionStore.listRecentMessages(message.sessionKey, 20);
      const promptContext = buildPromptContext({
        config,
        preferences,
        transcript,
      });

      let reply: string;
      try {
        reply = await generateModelReply({
          config,
          systemPrompt: promptContext.systemPrompt,
          transcript,
          sessionKey: message.sessionKey,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[conversation] model request failed for session=${message.sessionKey}`);
        console.error(error);
        reply =
          preferences.response_language === "en-US"
            ? `Model request failed: ${reason}`
            : `模型请求失败：${reason}`;
      }

      console.log(
        `[conversation] replying to session=${message.sessionKey} user=${message.userId} text=${JSON.stringify(reply)}`,
      );
      transcriptStore.append({
        id: crypto.randomUUID(),
        sessionKey: message.sessionKey,
        role: "assistant",
        content: reply,
      });

      if (typeof message.reply === "function") {
        await message.reply(reply);
      }
    },
  };
}
