import crypto from "node:crypto";
import { generateModelReply } from "../agent/model-client.js";
import {
  detectExplicitPreferenceUpdates,
  formatPreferenceSummary,
} from "../preferences/explicit-updates.js";
import { syncUserProfileFile } from "../preferences/user-profile-sync.js";
import { createScheduledTaskStore } from "../scheduled-tasks/store.js";
import type { DatabaseHandle } from "../store/db.js";
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
  db: DatabaseHandle;
  transcriptStore: TranscriptStore;
};

export function createConversationService({
  config,
  db,
  transcriptStore,
}: ConversationServiceParams) {
  const sessionStore = createSessionStore(db);
  const scheduledTaskStore = createScheduledTaskStore(db);
  const activeRuns = new Map<string, AbortController>();

  return {
    cancelSession(sessionKey: string): boolean {
      const controller = activeRuns.get(sessionKey);
      if (!controller) {
        return false;
      }
      controller.abort();
      return true;
    },
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
      const abortController = new AbortController();
      activeRuns.set(message.sessionKey, abortController);
      try {
        const result = await generateModelReply({
          config,
          systemPrompt: promptContext.systemPrompt,
          transcript,
          sessionKey: message.sessionKey,
          context: {
            sessionKey: message.sessionKey,
            userId: message.userId,
            guildId: message.guildId,
            channelId: message.channelId,
            threadId: message.threadId,
          },
          scheduledTaskStore,
          signal: abortController.signal,
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
        const aborted = abortController.signal.aborted || reason === "Request was cancelled";
        reply = aborted
          ? preferences.response_language === "en-US"
            ? "Cancelled the current run."
            : "已取消当前运行。"
          : preferences.response_language === "en-US"
            ? `Model request failed: ${reason}`
            : `模型请求失败：${reason}`;
      } finally {
        if (activeRuns.get(message.sessionKey) === abortController) {
          activeRuns.delete(message.sessionKey);
        }
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
