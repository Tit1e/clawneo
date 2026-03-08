import { loadConfig } from "./config/load-config.js";
import { createConversationService } from "./core/conversation-service.js";
import { startDiscordClient } from "./discord/client.js";
import { startScheduledTaskScheduler } from "./scheduled-tasks/scheduler.js";
import { createScheduledTaskStore } from "./scheduled-tasks/store.js";
import { createDatabase } from "./store/db.js";
import { createTranscriptStore } from "./transcripts/transcript-store.js";

export async function runApp(): Promise<void> {
  const config = loadConfig();
  const db = createDatabase(config.runtime.dbPath);
  const scheduledTaskStore = createScheduledTaskStore(db);
  const transcriptStore = createTranscriptStore({
    db,
    transcriptDir: config.runtime.transcriptDir,
  });
  const conversationService = createConversationService({
    config,
    db,
    transcriptStore,
  });

  if (!config.discord.token) {
    console.log(
      `ClawNeo initialized. Set discord.token in ${config.runtime.configPath} to enable the Discord adapter.`,
    );
    return;
  }

  const client = await startDiscordClient({
    config,
    onMessage: (message) => conversationService.handleMessage(message),
    onCancel: (sessionKey) => conversationService.cancelSession(sessionKey),
  });

  startScheduledTaskScheduler({
    client,
    store: scheduledTaskStore,
    transcriptStore,
  });
}
