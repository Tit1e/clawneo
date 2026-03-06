import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
} from "discord.js";
import { createDiscordMessageHandler } from "./message-handler.js";
import type { AppConfig, InboundMessage } from "../core/types.js";

type DiscordClientParams = {
  config: AppConfig;
  onMessage: (message: InboundMessage) => Promise<void>;
};

export async function startDiscordClient({
  config,
  onMessage,
}: DiscordClientParams): Promise<void> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  const handleMessage = createDiscordMessageHandler({ config, onMessage });

  client.once("clientReady", () => {
    console.log(`MiniClaw connected to Discord as ${client.user?.tag || "unknown-user"}.`);
  });

  client.on("messageCreate", async (message: Message) => {
    try {
      await handleMessage(message);
    } catch (error: unknown) {
      console.error("Failed to process Discord message.");
      console.error(error);
    }
  });

  await client.login(config.discord.token);
}
