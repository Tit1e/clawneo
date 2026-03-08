export const MIGRATIONS: string[] = [
  `
    CREATE TABLE IF NOT EXISTS sessions (
      session_key TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      user_id TEXT,
      guild_id TEXT,
      channel_id TEXT,
      thread_id TEXT,
      active_run_id TEXT,
      last_message_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_key TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_calls_json TEXT,
      created_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      source TEXT,
      confidence REAL DEFAULT 1.0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS pending_command_approvals (
      session_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      command TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      run_at TEXT,
      cron_expr TEXT,
      timezone TEXT NOT NULL,
      reminder_text TEXT NOT NULL,
      session_key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      guild_id TEXT,
      channel_id TEXT NOT NULL,
      thread_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_run_at TEXT,
      next_run_at TEXT NOT NULL,
      last_error TEXT
    )
  `,
];
