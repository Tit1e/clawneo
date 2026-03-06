import crypto from "node:crypto";
import type { Message } from "discord.js";
import { resolveSessionKey } from "../core/session-key.js";
import type { AppConfig, InboundMessage } from "../core/types.js";
import { sendChunkedDiscordReply } from "./reply.js";

type AllowDecision = {
  allowed: boolean;
  reason?: string;
};

function isAllowedMessage(message: Message, config: AppConfig): AllowDecision {
  if (message.author?.bot) {
    return { allowed: false, reason: "ignored bot message" };
  }

  const userRestricted = config.discord.allowedUserIds.length > 0;
  const guildRestricted = config.discord.allowedGuildIds.length > 0;

  if (userRestricted && !config.discord.allowedUserIds.includes(message.author.id)) {
    return { allowed: false, reason: `user ${message.author.id} not in DISCORD_ALLOWED_USER_IDS` };
  }

  if (guildRestricted && !message.guildId) {
    return {
      allowed: false,
      reason: "message is not in a guild but DISCORD_ALLOWED_GUILD_IDS is configured",
    };
  }

  if (guildRestricted && !config.discord.allowedGuildIds.includes(message.guildId || "")) {
    return {
      allowed: false,
      reason: `guild ${message.guildId} not in DISCORD_ALLOWED_GUILD_IDS`,
    };
  }

  return { allowed: true };
}

type MessageHandlerParams = {
  config: AppConfig;
  onMessage: (message: InboundMessage) => Promise<void>;
};

export function createDiscordMessageHandler({ config, onMessage }: MessageHandlerParams) {
  return async function handleDiscordMessage(message: Message): Promise<void> {
    const decision = isAllowedMessage(message, config);
    if (!decision.allowed) {
      console.log(
        `[discord] skipped message ${message.id} from user=${message.author?.id || "unknown"} channel=${message.channelId}: ${decision.reason || "not allowed"}`,
      );
      return;
    }

    const text = message.content?.trim();
    if (!text) {
      console.log(`[discord] skipped message ${message.id}: empty content`);
      return;
    }

    const baseMessage: Omit<InboundMessage, "sessionKey"> = {
      messageId: message.id || crypto.randomUUID(),
      platform: "discord",
      userId: message.author.id,
      guildId: message.guildId || undefined,
      channelId: message.channelId,
      threadId: message.channel.isThread() ? message.channel.id : undefined,
      text,
      createdAt: new Date(message.createdTimestamp || Date.now()).toISOString(),
      reply: async (content: string) => sendChunkedDiscordReply(content, (chunk) => message.reply(chunk)),
    };

    const normalized: InboundMessage = {
      ...baseMessage,
      sessionKey: resolveSessionKey(baseMessage),
    };

    console.log(
      `[discord] inbound message ${normalized.messageId} session=${normalized.sessionKey} user=${normalized.userId} channel=${normalized.channelId}`,
    );
    await onMessage(normalized);
  };
}
