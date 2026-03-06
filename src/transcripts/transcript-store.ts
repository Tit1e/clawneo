import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { StoredMessage } from "../core/types.js";

function sanitizeSessionKey(sessionKey: string): string {
  return sessionKey.replace(/[^a-zA-Z0-9:_-]/g, "_").replace(/[:/]/g, "__");
}

function nowIso(): string {
  return new Date().toISOString();
}

type TranscriptStoreParams = {
  db: DatabaseSync;
  transcriptDir: string;
};

export function createTranscriptStore({ db, transcriptDir }: TranscriptStoreParams) {
  const insertStatement = db.prepare(`
    INSERT INTO messages (id, session_key, role, content, tool_calls_json, created_at)
    VALUES (@id, @session_key, @role, @content, @tool_calls_json, @created_at)
  `);

  return {
    append(entry: Omit<StoredMessage, "createdAt"> & { createdAt?: string }): void {
      const createdAt = entry.createdAt || nowIso();
      insertStatement.run({
        id: entry.id,
        session_key: entry.sessionKey,
        role: entry.role,
        content: entry.content,
        tool_calls_json: entry.toolCalls ? JSON.stringify(entry.toolCalls) : null,
        created_at: createdAt,
      });

      const targetPath = path.join(transcriptDir, `${sanitizeSessionKey(entry.sessionKey)}.jsonl`);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.appendFileSync(
        targetPath,
        `${JSON.stringify({
          id: entry.id,
          role: entry.role,
          content: entry.content,
          toolCalls: entry.toolCalls || null,
          createdAt,
        })}\n`,
      );
    },
  };
}
