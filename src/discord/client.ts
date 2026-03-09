import {
  type ChatInputCommandInteraction,
  Client,
  GatewayIntentBits,
  Interaction,
  Partials,
  type Message,
} from "discord.js";
import { createDiscordMessageHandler } from "./message-handler.js";
import { handleSystemCommand, registerSlashCommands, replyToInteraction } from "./system-commands.js";
import type { AppConfig, InboundMessage } from "../core/types.js";

type DiscordClientParams = {
  config: AppConfig;
  onMessage: (message: InboundMessage) => Promise<void>;
  onCancel: (sessionKey: string) => boolean;
};

export async function startDiscordClient({
  config,
  onMessage,
  onCancel,
}: DiscordClientParams): Promise<Client> {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  const handleMessage = createDiscordMessageHandler({ config, onMessage, onCancel });

  client.once("clientReady", () => {
    console.log(`ClawNeo connected to Discord as ${client.user?.tag || "unknown-user"}.`);
    void registerSlashCommands(client, config).catch((error) => {
      console.error("[discord] failed to register slash commands");
      console.error(error);
    });
  });

  client.on("messageCreate", async (message: Message) => {
    try {
      await handleMessage(message);
    } catch (error: unknown) {
      console.error("Failed to process Discord message.");
      console.error(error);
    }
  });

  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      const command = interaction.commandName.trim().toLowerCase();
      const handled = await handleSystemCommand({
        config,
        command,
        userId: interaction.user.id,
        guildId: interaction.guildId || undefined,
        channelId: interaction.channelId,
        threadId: interaction.channel?.isThread?.() ? interaction.channel.id : undefined,
        reply: async (content) => replyToInteraction(interaction as ChatInputCommandInteraction, content),
        onCancel,
      });

      if (handled) {
        console.log(
          `[discord] slash command /${command} from user=${interaction.user.id} channel=${interaction.channelId}`,
        );
      }
    } catch (error: unknown) {
      console.error("Failed to process Discord interaction.");
      console.error(error);
    }
  });

  await client.login(config.discord.token);
  return client;
}
