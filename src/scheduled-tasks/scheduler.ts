import crypto from "node:crypto";
import type { Client } from "discord.js";
import { sendDiscordMessage } from "../discord/notifier.js";
import type { ScheduledTaskStore } from "./store.js";
import { resolveNextRunAtForCron } from "./time.js";

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

type ScheduledTaskSchedulerParams = {
  client: Client;
  store: ScheduledTaskStore;
  transcriptStore: TranscriptStore;
  intervalMs?: number;
};

function renderReminderMessage(task: {
  reminderText: string;
  id: string;
  nextRunAt: string;
}): string {
  return [
    "提醒时间到了：",
    `- ${task.reminderText}`,
    `- 任务 ID：${task.id}`,
    `- 计划时间：${task.nextRunAt}`,
  ].join("\n");
}

export function startScheduledTaskScheduler({
  client,
  store,
  transcriptStore,
  intervalMs = 15_000,
}: ScheduledTaskSchedulerParams): { stop: () => void } {
  const runningTaskIds = new Set<string>();

  const runOnce = async (): Promise<void> => {
    const dueTasks = store.listDueTasks(20);

    for (const task of dueTasks) {
      if (runningTaskIds.has(task.id)) {
        continue;
      }

      runningTaskIds.add(task.id);

      try {
        const claimed = store.claimTask(task.id);
        if (!claimed) {
          continue;
        }

        const executionTime = new Date();
        const reminderMessage = renderReminderMessage(task);
        await sendDiscordMessage({
          client,
          channelId: task.channelId,
          threadId: task.threadId,
          content: reminderMessage,
        });

        transcriptStore.append({
          id: crypto.randomUUID(),
          sessionKey: task.sessionKey,
          role: "assistant",
          content: reminderMessage,
        });

        if (task.kind === "recurring" && task.cronExpr) {
          const nextRunAt = resolveNextRunAtForCron(
            task.cronExpr,
            task.timezone,
            executionTime,
          );
          store.markTaskExecution({
            id: task.id,
            status: "active",
            nextRunAt,
            lastError: null,
          });
        } else {
          store.markTaskExecution({
            id: task.id,
            status: "done",
            nextRunAt: task.nextRunAt,
            lastError: null,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[scheduler] failed to deliver reminder task=${task.id}`);
        console.error(error);
        if (task.kind === "recurring" && task.cronExpr) {
          const nextRunAt = resolveNextRunAtForCron(
            task.cronExpr,
            task.timezone,
            new Date(),
          );
          store.markTaskExecution({
            id: task.id,
            status: "active",
            nextRunAt,
            lastError: message,
          });
        } else {
          store.markTaskExecution({
            id: task.id,
            status: "failed",
            nextRunAt: task.nextRunAt,
            lastError: message,
          });
        }
      } finally {
        runningTaskIds.delete(task.id);
      }
    }
  };

  const timer = setInterval(() => {
    void runOnce();
  }, intervalMs);

  timer.unref?.();
  void runOnce();

  return {
    stop(): void {
      clearInterval(timer);
    },
  };
}
