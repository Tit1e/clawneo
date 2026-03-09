import type { CreateScheduledTaskInput, ScheduledTask, ScheduledTaskStatus } from "./types.js";
import type { DatabaseHandle } from "../store/db.js";

type ScheduledTaskRow = {
  id: string;
  kind: string;
  schedule_type: string;
  run_at: string | null;
  cron_expr: string | null;
  timezone: string;
  reminder_text: string;
  session_key: string;
  user_id: string;
  guild_id: string | null;
  channel_id: string;
  thread_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string;
  last_error: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: ScheduledTaskRow): ScheduledTask {
  return {
    id: row.id,
    kind: row.kind as ScheduledTask["kind"],
    scheduleType: row.schedule_type as ScheduledTask["scheduleType"],
    runAt: row.run_at || undefined,
    cronExpr: row.cron_expr || undefined,
    timezone: row.timezone,
    reminderText: row.reminder_text,
    sessionKey: row.session_key,
    userId: row.user_id,
    guildId: row.guild_id || undefined,
    channelId: row.channel_id,
    threadId: row.thread_id || undefined,
    status: row.status as ScheduledTaskStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRunAt: row.last_run_at || undefined,
    nextRunAt: row.next_run_at,
    lastError: row.last_error || undefined,
  };
}

export function createScheduledTaskStore(db: DatabaseHandle) {
  const insertTaskStatement = db.prepare(`
    INSERT INTO scheduled_tasks (
      id, kind, schedule_type, run_at, cron_expr, timezone, reminder_text,
      session_key, user_id, guild_id, channel_id, thread_id, status,
      created_at, updated_at, last_run_at, next_run_at, last_error
    ) VALUES (
      @id, @kind, @schedule_type, @run_at, @cron_expr, @timezone, @reminder_text,
      @session_key, @user_id, @guild_id, @channel_id, @thread_id, @status,
      @created_at, @updated_at, NULL, @next_run_at, NULL
    )
  `);

  const listTasksStatement = db.prepare(`
    SELECT *
    FROM scheduled_tasks
    WHERE user_id = @user_id
      AND (@session_key IS NULL OR session_key = @session_key)
      AND (@status IS NULL OR status = @status)
    ORDER BY next_run_at ASC, created_at DESC
    LIMIT @limit
  `);

  const listDueTasksStatement = db.prepare(`
    SELECT *
    FROM scheduled_tasks
    WHERE status = 'active'
      AND next_run_at <= @now
    ORDER BY next_run_at ASC
    LIMIT @limit
  `);

  const getTaskByIdStatement = db.prepare(`
    SELECT *
    FROM scheduled_tasks
    WHERE id = ?
    LIMIT 1
  `);

  const getLatestActiveTaskStatement = db.prepare(`
    SELECT *
    FROM scheduled_tasks
    WHERE user_id = @user_id
      AND session_key = @session_key
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const cancelTaskStatement = db.prepare(`
    UPDATE scheduled_tasks
    SET status = 'cancelled',
        updated_at = @updated_at
    WHERE id = @id
      AND status IN ('active', 'delivering')
  `);

  const claimTaskStatement = db.prepare(`
    UPDATE scheduled_tasks
    SET status = 'delivering',
        updated_at = @updated_at
    WHERE id = @id
      AND status = 'active'
  `);

  const markTaskDoneStatement = db.prepare(`
    UPDATE scheduled_tasks
    SET status = @status,
        updated_at = @updated_at,
        last_run_at = @last_run_at,
        next_run_at = @next_run_at,
        last_error = @last_error
    WHERE id = @id
  `);

  return {
    createTask(input: CreateScheduledTaskInput): ScheduledTask {
      const timestamp = nowIso();
      insertTaskStatement.run({
        id: input.id,
        kind: input.kind,
        schedule_type: input.scheduleType,
        run_at: input.runAt || null,
        cron_expr: input.cronExpr || null,
        timezone: input.timezone,
        reminder_text: input.reminderText,
        session_key: input.sessionKey,
        user_id: input.userId,
        guild_id: input.guildId || null,
        channel_id: input.channelId,
        thread_id: input.threadId || null,
        status: "active",
        created_at: timestamp,
        updated_at: timestamp,
        next_run_at: input.nextRunAt,
      });

      const row = getTaskByIdStatement.get(input.id) as ScheduledTaskRow | undefined;
      if (!row) {
        throw new Error(`Failed to load newly created scheduled task: ${input.id}`);
      }
      return mapRow(row);
    },
    listTasks(params: {
      userId: string;
      sessionKey?: string;
      status?: ScheduledTaskStatus;
      limit?: number;
    }): ScheduledTask[] {
      const rows = listTasksStatement.all({
        user_id: params.userId,
        session_key: params.sessionKey || null,
        status: params.status || null,
        limit: params.limit ?? 20,
      }) as ScheduledTaskRow[];
      return rows.map(mapRow);
    },
    listDueTasks(limit = 20): ScheduledTask[] {
      const rows = listDueTasksStatement.all({
        now: nowIso(),
        limit,
      }) as ScheduledTaskRow[];
      return rows.map(mapRow);
    },
    getTaskById(taskId: string): ScheduledTask | null {
      const row = getTaskByIdStatement.get(taskId) as ScheduledTaskRow | undefined;
      return row ? mapRow(row) : null;
    },
    getLatestActiveTask(userId: string, sessionKey: string): ScheduledTask | null {
      const row = getLatestActiveTaskStatement.get({
        user_id: userId,
        session_key: sessionKey,
      }) as ScheduledTaskRow | undefined;
      return row ? mapRow(row) : null;
    },
    cancelTask(taskId: string): boolean {
      const result = cancelTaskStatement.run({
        id: taskId,
        updated_at: nowIso(),
      });
      return Number(result.changes) > 0;
    },
    claimTask(taskId: string): boolean {
      const result = claimTaskStatement.run({
        id: taskId,
        updated_at: nowIso(),
      });
      return Number(result.changes) > 0;
    },
    markTaskExecution(params: {
      id: string;
      status: ScheduledTaskStatus;
      nextRunAt?: string | null;
      lastError?: string | null;
    }): void {
      markTaskDoneStatement.run({
        id: params.id,
        status: params.status,
        updated_at: nowIso(),
        last_run_at: nowIso(),
        next_run_at: params.nextRunAt || nowIso(),
        last_error: params.lastError || null,
      });
    },
  };
}

export type ScheduledTaskStore = ReturnType<typeof createScheduledTaskStore>;
