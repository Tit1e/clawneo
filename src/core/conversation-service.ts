import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { generateModelReply } from "../agent/model-client.js";
import {
  detectExplicitPreferenceUpdates,
  formatPreferenceSummary,
} from "../preferences/explicit-updates.js";
import { syncUserProfileFile } from "../preferences/user-profile-sync.js";
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

      const explicitPreferenceUpdates = detectExplicitPreferenceUpdates(message.text);
      if (explicitPreferenceUpdates.length > 0) {
        sessionStore.applyPreferenceUpdates(message.userId, explicitPreferenceUpdates);
      }

      const preferences = sessionStore.listPreferences(message.userId);
      if (explicitPreferenceUpdates.length > 0) {
        try {
          syncUserProfileFile(config.agent.userProfilePath, preferences);
        } catch (error) {
          console.error(`[conversation] failed to sync USER.md for user=${message.userId}`);
          console.error(error);
        }
      }

      const transcript = sessionStore.listRecentMessages(message.sessionKey, 20);
      const promptContext = buildPromptContext({
        config,
        preferences,
        transcript,
      });

      let reply: string;
      let toolEvents: Array<{ toolName: string; content: string; rawContent: string; isError: boolean }> = [];
      try {
        const result = await generateModelReply({
          config,
          systemPrompt: promptContext.systemPrompt,
          transcript,
          sessionKey: message.sessionKey,
        });
        reply = result.reply;
        toolEvents = result.toolEvents;
        if (explicitPreferenceUpdates.length > 0) {
          const updatedPreferenceLines = formatPreferenceSummary(
            Object.fromEntries(explicitPreferenceUpdates.map((update) => [update.key, update.value])),
          );
          const prefix =
            preferences.response_language === "en-US"
              ? `Updated preferences:\n${updatedPreferenceLines.join("\n")}\n\n`
              : `已更新偏好：\n${updatedPreferenceLines.join("\n")}\n\n`;
          reply = `${prefix}${reply}`.trim();
        }
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
      for (const toolEvent of toolEvents) {
        transcriptStore.append({
          id: crypto.randomUUID(),
          sessionKey: message.sessionKey,
          role: "tool",
          content: `[${toolEvent.toolName}] ${toolEvent.isError ? "error" : "ok"}\n${toolEvent.content}`,
          toolCalls: {
            rawContent: toolEvent.rawContent,
          },
        });
      }
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
