import { loadConfig } from "./config/load-config.js";
import { createConversationService } from "./core/conversation-service.js";
import { startDiscordClient } from "./discord/client.js";
import { createDatabase } from "./store/db.js";
import { createTranscriptStore } from "./transcripts/transcript-store.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createDatabase(config.runtime.dbPath);
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
    console.log("MiniClaw initialized. Set DISCORD_TOKEN to enable the Discord adapter.");
    return;
  }

  await startDiscordClient({
    config,
    onMessage: (message) => conversationService.handleMessage(message),
  });
}

main().catch((error: unknown) => {
  console.error("MiniClaw failed to start.");
  console.error(error);
  process.exitCode = 1;
});
