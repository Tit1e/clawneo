import crypto from "node:crypto";
import type { Message } from "discord.js";
import { resolveSessionKey } from "../core/session-key.js";
import type { AppConfig, InboundMessage } from "../core/types.js";
import { sendChunkedDiscordReply } from "./reply.js";
import { handleSystemCommand, renderSystemCommandHelp, replyToDiscordMessage } from "./system-commands.js";

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
  onCancel: (sessionKey: string) => boolean;
};

function canSendTyping(channel: Message["channel"]): channel is Message["channel"] & {
  sendTyping: () => Promise<unknown>;
} {
  return typeof (channel as { sendTyping?: unknown }).sendTyping === "function";
}

function canSendMessage(channel: Message["channel"]): channel is Message["channel"] & {
  send: (content: string) => Promise<unknown>;
} {
  return typeof (channel as { send?: unknown }).send === "function";
}

export function createDiscordMessageHandler({ config, onMessage, onCancel }: MessageHandlerParams) {
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
      reply: async (content: string) => {
        if (canSendMessage(message.channel)) {
          const channel = message.channel;
          return sendChunkedDiscordReply(content, (chunk) => channel.send(chunk));
        }
        return sendChunkedDiscordReply(content, (chunk) => message.reply(chunk));
      },
    };

    const sessionKey = resolveSessionKey(baseMessage);

    if (text.startsWith("/")) {
      const command = text.slice(1).trim().toLowerCase();
      const handled = await handleSystemCommand({
        config,
        command,
        userId: message.author.id,
        guildId: message.guildId || undefined,
        channelId: message.channelId,
        threadId: message.channel.isThread() ? message.channel.id : undefined,
        reply: async (content) => replyToDiscordMessage(message, content),
        onCancel,
      });
      if (handled) {
        console.log(
          `[discord] system command /${command} from user=${message.author.id} channel=${message.channelId}${command === "cancel" ? ` session=${sessionKey}` : ""}`,
        );
        return;
      }
      console.log(
        `[discord] unknown system command ${JSON.stringify(text)} from user=${message.author.id} channel=${message.channelId}`,
      );
      await replyToDiscordMessage(
        message,
        `未知系统命令：${text}\n\n${renderSystemCommandHelp()}`,
      );
      return;
    }

    const normalized: InboundMessage = {
      ...baseMessage,
      sessionKey,
    };

    console.log(
      `[discord] inbound message ${normalized.messageId} session=${normalized.sessionKey} user=${normalized.userId} channel=${normalized.channelId}`,
    );

    if (canSendTyping(message.channel)) {
      try {
        await message.channel.sendTyping();
      } catch (error) {
        console.error(`[discord] failed to send typing for message ${message.id}`);
        console.error(error);
      }
    }

    const typingInterval = setInterval(() => {
      if (!canSendTyping(message.channel)) {
        return;
      }
      void message.channel.sendTyping().catch((error: unknown) => {
        console.error(`[discord] failed to refresh typing for message ${message.id}`);
        console.error(error);
      });
    }, 8000);

    try {
      await onMessage(normalized);
    } finally {
      clearInterval(typingInterval);
    }
  };
}
