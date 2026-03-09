import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { ToolRequestContext } from "../core/types.js";
import {
  formatCronExprForDisplay,
  formatRunAtForDisplay,
  resolveNextRunAtForCron,
  resolveTaskTimezone,
  validateRunAt,
} from "../scheduled-tasks/time.js";
import type { ScheduledTaskStore } from "../scheduled-tasks/store.js";
import type { ScheduledTaskStatus } from "../scheduled-tasks/types.js";

type CreateScheduledTaskParams = {
  kind: "once" | "recurring";
  scheduleType: "at" | "cron";
  runAt?: string;
  cronExpr?: string;
  timezone?: string;
  reminderText: string;
};

type ListScheduledTasksParams = {
  scope?: "session" | "user";
  status?: ScheduledTaskStatus;
  limit?: number;
};

type CancelScheduledTaskParams = {
  taskId?: string;
  latest?: boolean;
};

type ScheduledTaskToolParams = {
  store: ScheduledTaskStore;
  context: ToolRequestContext;
};

function formatTaskSummary(task: {
  id: string;
  reminderText: string;
  kind: string;
  timezone: string;
  nextRunAt: string;
  cronExpr?: string;
  status: string;
}): string {
  const lines = [
    `ID: ${task.id}`,
    `内容: ${task.reminderText}`,
    `状态: ${task.status}`,
    `类型: ${task.kind}`,
    `时区: ${task.timezone}`,
  ];

  if (task.kind === "once") {
    lines.push(`提醒时间: ${task.nextRunAt}`);
  } else {
    lines.push(`Cron: ${task.cronExpr || "(missing)"}`);
    lines.push(`下次执行: ${task.nextRunAt}`);
  }

  return lines.join("\n");
}

function formatCreatedTaskMessage(task: {
  kind: "once" | "recurring";
  reminderText: string;
  timezone: string;
  runAt?: string;
  cronExpr?: string;
}): string {
  if (task.kind === "once") {
    if (!task.runAt) {
      throw new Error("runAt is required for one-shot reminders.");
    }

    return [
      "提醒已创建：",
      `时间：${formatRunAtForDisplay(task.runAt, task.timezone)}`,
      `内容：${task.reminderText}`,
    ].join("\n");
  }

  if (!task.cronExpr) {
    throw new Error("cronExpr is required for recurring reminders.");
  }

  return [
    "重复提醒已创建：",
    `频率：${formatCronExprForDisplay(task.cronExpr)}`,
    `内容：${task.reminderText}`,
  ].join("\n");
}

export function createCreateScheduledTaskTool({
  store,
  context,
}: ScheduledTaskToolParams): ToolDefinition {
  return {
    name: "create_scheduled_task",
    label: "Create Scheduled Task",
    description: "Create a reminder-style scheduled task for the current Discord conversation.",
    parameters: Type.Object({
      kind: Type.Union([Type.Literal("once"), Type.Literal("recurring")]),
      scheduleType: Type.Union([Type.Literal("at"), Type.Literal("cron")]),
      runAt: Type.Optional(Type.String()),
      cronExpr: Type.Optional(Type.String()),
      timezone: Type.Optional(Type.String()),
      reminderText: Type.String({ minLength: 1 }),
    }),
    execute: async (_toolCallId, rawParams) => {
      const params = rawParams as CreateScheduledTaskParams;
      const reminderText = params.reminderText?.trim();
      if (!reminderText) {
        throw new Error("reminderText is required.");
      }

      const timezoneProvided = Boolean(params.timezone?.trim());
      const timezone = resolveTaskTimezone(params.timezone);
      let runAt: string | undefined;
      let cronExpr: string | undefined;
      let nextRunAt: string;

      if (params.kind === "once") {
        if (params.scheduleType !== "at") {
          throw new Error('One-shot reminders must use scheduleType="at".');
        }
        if (!params.runAt?.trim()) {
          throw new Error("runAt is required for one-shot reminders.");
        }
        runAt = validateRunAt(params.runAt);
        nextRunAt = runAt;
      } else {
        if (params.scheduleType !== "cron") {
          throw new Error('Recurring reminders must use scheduleType="cron".');
        }
        if (!params.cronExpr?.trim()) {
          throw new Error("cronExpr is required for recurring reminders.");
        }
        cronExpr = params.cronExpr.trim();
        nextRunAt = resolveNextRunAtForCron(cronExpr, timezone);
      }

      const task = store.createTask({
        id: crypto.randomUUID(),
        kind: params.kind,
        scheduleType: params.scheduleType,
        runAt,
        cronExpr,
        timezone,
        reminderText,
        sessionKey: context.sessionKey,
        userId: context.userId,
        guildId: context.guildId,
        channelId: context.channelId,
        threadId: context.threadId,
        nextRunAt,
      });

      return {
        content: [
          {
            type: "text",
            text: [
              formatCreatedTaskMessage(task),
              timezoneProvided ? "" : `时区未显式指定，已使用当前机器默认时区：${timezone}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
        details: {
          taskId: task.id,
          nextRunAt: task.nextRunAt,
          kind: task.kind,
          timezone,
          timezoneSource: timezoneProvided ? "explicit" : "system-default",
        },
      };
    },
  };
}

export function createListScheduledTasksTool({
  store,
  context,
}: ScheduledTaskToolParams): ToolDefinition {
  return {
    name: "list_scheduled_tasks",
    label: "List Scheduled Tasks",
    description: "List reminder-style scheduled tasks for the current user or current session.",
    parameters: Type.Object({
      scope: Type.Optional(Type.Union([Type.Literal("session"), Type.Literal("user")])),
      status: Type.Optional(
        Type.Union([
          Type.Literal("active"),
          Type.Literal("delivering"),
          Type.Literal("done"),
          Type.Literal("cancelled"),
          Type.Literal("failed"),
        ]),
      ),
      limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
    }),
    execute: async (_toolCallId, rawParams) => {
      const params = (rawParams || {}) as ListScheduledTasksParams;
      const scope = params.scope || "user";
      const tasks = store.listTasks({
        userId: context.userId,
        sessionKey: scope === "session" ? context.sessionKey : undefined,
        status: params.status,
        limit: params.limit ?? 20,
      });

      if (tasks.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: scope === "session" ? "当前会话没有找到提醒任务。" : "当前用户没有找到提醒任务。",
            },
          ],
          details: {
            tasks: [],
          },
        };
      }

      const text = tasks
        .map((task, index) => [`${index + 1}.`, formatTaskSummary(task)].join("\n"))
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text,
          },
        ],
        details: {
          taskIds: tasks.map((task) => task.id),
        },
      };
    },
  };
}

export function createCancelScheduledTaskTool({
  store,
  context,
}: ScheduledTaskToolParams): ToolDefinition {
  return {
    name: "cancel_scheduled_task",
    label: "Cancel Scheduled Task",
    description: "Cancel a reminder-style scheduled task by id, or cancel the latest active task in the current session.",
    parameters: Type.Object({
      taskId: Type.Optional(Type.String()),
      latest: Type.Optional(Type.Boolean()),
    }),
    execute: async (_toolCallId, rawParams) => {
      const params = (rawParams || {}) as CancelScheduledTaskParams;
      let targetTaskId = params.taskId?.trim();

      if (!targetTaskId) {
        const latestTask = store.getLatestActiveTask(context.userId, context.sessionKey);
        if (!latestTask) {
          throw new Error("当前会话没有可取消的活动提醒任务。");
        }
        targetTaskId = latestTask.id;
      }

      const task = store.getTaskById(targetTaskId);
      if (!task) {
        throw new Error(`Reminder task not found: ${targetTaskId}`);
      }
      if (task.userId !== context.userId) {
        throw new Error("只能取消当前用户创建的提醒任务。");
      }
      if (task.status !== "active") {
        throw new Error(`Reminder task ${targetTaskId} is already ${task.status}.`);
      }

      const cancelled = store.cancelTask(targetTaskId);
      if (!cancelled) {
        throw new Error(`Failed to cancel reminder task: ${targetTaskId}`);
      }

      return {
        content: [
          {
            type: "text",
            text: `已取消提醒任务。\n\n${formatTaskSummary({
              ...task,
              status: "cancelled",
            })}`,
          },
        ],
        details: {
          taskId: targetTaskId,
        },
      };
    },
  };
}
