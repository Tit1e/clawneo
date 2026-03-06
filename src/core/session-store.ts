import type { DatabaseSync } from "node:sqlite";
import type { InboundMessage, StoredMessage, UserPreferences } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

type SessionMessageRow = {
  id: string;
  session_key: string;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_calls_json: string | null;
  created_at: string;
};

type PreferenceRow = {
  key: string;
  value_json: string;
};

export function createSessionStore(db: DatabaseSync) {
  const ensureSessionStatement = db.prepare(`
    INSERT INTO sessions (
      session_key,
      platform,
      user_id,
      guild_id,
      channel_id,
      thread_id,
      active_run_id,
      last_message_at,
      created_at,
      updated_at
    ) VALUES (
      @session_key,
      @platform,
      @user_id,
      @guild_id,
      @channel_id,
      @thread_id,
      NULL,
      @last_message_at,
      @created_at,
      @updated_at
    )
    ON CONFLICT(session_key) DO UPDATE SET
      user_id = excluded.user_id,
      guild_id = excluded.guild_id,
      channel_id = excluded.channel_id,
      thread_id = excluded.thread_id,
      last_message_at = excluded.last_message_at,
      updated_at = excluded.updated_at
  `);

  const listRecentMessagesStatement = db.prepare(`
    SELECT id, session_key, role, content, tool_calls_json, created_at
    FROM messages
    WHERE session_key = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const listPreferencesStatement = db.prepare(`
    SELECT key, value_json
    FROM user_preferences
    WHERE user_id = ?
    ORDER BY key ASC
  `);

  return {
    ensureSession(message: InboundMessage): void {
      const timestamp = message.createdAt || nowIso();
      ensureSessionStatement.run({
        session_key: message.sessionKey,
        platform: message.platform,
        user_id: message.userId,
        guild_id: message.guildId || null,
        channel_id: message.channelId || null,
        thread_id: message.threadId || null,
        last_message_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      });
    },
    listRecentMessages(sessionKey: string, limit = 20): StoredMessage[] {
      const rows = listRecentMessagesStatement.all(sessionKey, limit) as SessionMessageRow[];
      return rows.reverse().map((row) => ({
        id: row.id,
        sessionKey: row.session_key,
        role: row.role,
        content: row.content,
        toolCalls: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : undefined,
        createdAt: row.created_at,
      }));
    },
    listPreferences(userId: string): UserPreferences {
      const rows = listPreferencesStatement.all(userId) as PreferenceRow[];
      const preferences: UserPreferences = {};
      for (const row of rows) {
        try {
          preferences[row.key] = JSON.parse(row.value_json);
        } catch {
          preferences[row.key] = row.value_json;
        }
      }
      return preferences;
    },
  };
}
