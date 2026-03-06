import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { buildPromptContext } from "./prompt-builder.js";
import { createSessionStore } from "./session-store.js";
import type { AppConfig, InboundMessage, UserPreferences } from "./types.js";

function buildPlaceholderReply(message: InboundMessage, preferences: UserPreferences): string {
  const language = preferences.response_language || "zh-CN";
  if (language === "en-US") {
    return `MiniClaw has received your message: ${message.text}`;
  }
  return `MiniClaw 已收到你的消息：${message.text}`;
}

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
      buildPromptContext({
        config,
        preferences,
        transcript,
      });

      const reply = buildPlaceholderReply(message, preferences);
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
