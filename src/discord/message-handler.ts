import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Message } from "discord.js";
import { resolveSessionKey } from "../core/session-key.js";
import type { AppConfig, InboundAttachment, InboundMessage } from "../core/types.js";
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

function sanitizeFileName(input: string): string {
  const normalized = input.trim().replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_");
  return normalized || "attachment";
}

function createUniqueFilePath(dirPath: string, fileName: string): string {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "attachment";
  const extension = parsed.ext || "";
  let candidate = path.join(dirPath, `${baseName}${extension}`);
  let index = 1;

  while (fs.existsSync(candidate)) {
    candidate = path.join(dirPath, `${baseName}-${index}${extension}`);
    index += 1;
  }

  return candidate;
}

function resolveAttachmentTempDir(config: AppConfig): string {
  return path.join(config.runtime.stateDir, "tmp", "discord-attachments");
}

async function saveDiscordAttachments(message: Message, config: AppConfig): Promise<InboundAttachment[]> {
  if (message.attachments.size === 0) {
    return [];
  }

  const baseDir = resolveAttachmentTempDir(config);
  const createdAt = new Date(message.createdTimestamp || Date.now()).toISOString().slice(0, 10);
  const messageDir = path.join(baseDir, createdAt, message.id || crypto.randomUUID());
  fs.mkdirSync(messageDir, { recursive: true });

  const savedAttachments: InboundAttachment[] = [];

  try {
    let index = 0;
    for (const [attachmentId, attachment] of message.attachments) {
      index += 1;
      const originalName = attachment.name?.trim() || `attachment-${index}`;
      const safeName = sanitizeFileName(originalName);
      const filePath = createUniqueFilePath(messageDir, safeName);
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(`download failed for ${originalName}: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);
      savedAttachments.push({
        id: attachmentId,
        name: originalName,
        url: attachment.url,
        contentType: attachment.contentType || undefined,
        size: attachment.size ?? buffer.byteLength,
        localPath: filePath,
      });
    }
  } catch (error) {
    fs.rmSync(messageDir, { recursive: true, force: true });
    throw error;
  }

  return savedAttachments;
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

    const text = message.content?.trim() || "";
    const hasAttachments = message.attachments.size > 0;
    if (!text && !hasAttachments) {
      console.log(`[discord] skipped message ${message.id}: empty content and no attachments`);
      return;
    }

    if (text.startsWith("/")) {
      const command = text.slice(1).trim().toLowerCase();
      const sessionKey = resolveSessionKey({
        messageId: message.id || crypto.randomUUID(),
        platform: "discord",
        userId: message.author.id,
        guildId: message.guildId || undefined,
        channelId: message.channelId,
        threadId: message.channel.isThread() ? message.channel.id : undefined,
        text,
        attachments: [],
        createdAt: new Date(message.createdTimestamp || Date.now()).toISOString(),
      });
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

    let attachments: InboundAttachment[] = [];
    if (hasAttachments) {
      try {
        attachments = await saveDiscordAttachments(message, config);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error(`[discord] failed to save attachments for message ${message.id}`);
        console.error(error);
        await replyToDiscordMessage(message, `附件保存失败，未发送给 AI：${reason}`);
        return;
      }
    }

    const baseMessage: Omit<InboundMessage, "sessionKey"> = {
      messageId: message.id || crypto.randomUUID(),
      platform: "discord",
      userId: message.author.id,
      guildId: message.guildId || undefined,
      channelId: message.channelId,
      threadId: message.channel.isThread() ? message.channel.id : undefined,
      text,
      attachments,
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

    const normalized: InboundMessage = {
      ...baseMessage,
      sessionKey,
    };

    console.log(
      `[discord] inbound message ${normalized.messageId} session=${normalized.sessionKey} user=${normalized.userId} channel=${normalized.channelId} attachments=${normalized.attachments.length}`,
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
