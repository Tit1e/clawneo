export type ScheduledTaskKind = "once" | "recurring";
export type ScheduledTaskScheduleType = "at" | "cron";
export type ScheduledTaskStatus = "active" | "done" | "cancelled" | "failed";

export type ScheduledTask = {
  id: string;
  kind: ScheduledTaskKind;
  scheduleType: ScheduledTaskScheduleType;
  runAt?: string;
  cronExpr?: string;
  timezone: string;
  reminderText: string;
  sessionKey: string;
  userId: string;
  guildId?: string;
  channelId: string;
  threadId?: string;
  status: ScheduledTaskStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt: string;
  lastError?: string;
};

export type CreateScheduledTaskInput = {
  id: string;
  kind: ScheduledTaskKind;
  scheduleType: ScheduledTaskScheduleType;
  runAt?: string;
  cronExpr?: string;
  timezone: string;
  reminderText: string;
  sessionKey: string;
  userId: string;
  guildId?: string;
  channelId: string;
  threadId?: string;
  nextRunAt: string;
};
