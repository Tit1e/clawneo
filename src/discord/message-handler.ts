import crypto from "node:crypto";
import type { Message } from "discord.js";
import { collectStatusSnapshot, renderStatusPlainText } from "../cli/status.js";
import { runDetachedServiceCommand, runDetachedUpdateCommand } from "../cli/service-manager.js";
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

async function replyToDiscordMessage(message: Message, content: string): Promise<void> {
  if (canSendMessage(message.channel)) {
    const channel = message.channel;
    await sendChunkedDiscordReply(content, (chunk) => channel.send(chunk));
    return;
  }
  await sendChunkedDiscordReply(content, (chunk) => message.reply(chunk));
}

function renderSystemCommandHelp(): string {
  return [
    "ClawNeo 系统命令：",
    "",
    "- /help：查看这份命令说明",
    "- /status：查看当前服务状态",
    "- /cancel：取消当前会话正在运行的任务",
    "- /update：升级到最新版本并重启服务",
    "- /restart：重启服务",
    "- /stop：停止服务",
    "",
    "说明：",
    "- 这些命令不经过 AI 模型",
    "- /cancel 只会取消当前 Discord 会话里的任务，不会停止整个服务",
    "- /update 会在后台执行 npm 全局升级，然后自动重启服务",
    "- /stop 后 bot 会离线",
    "- 停止后需要通过 CLI 执行 clawneo start 才能重新启动",
  ].join("\n");
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

    if (text === "/status") {
      console.log(
        `[discord] system command /status from user=${message.author.id} channel=${message.channelId}`,
      );
      const statusText = renderStatusPlainText(collectStatusSnapshot());
      await replyToDiscordMessage(message, statusText);
      return;
    }

    if (text === "/help") {
      console.log(
        `[discord] system command /help from user=${message.author.id} channel=${message.channelId}`,
      );
      await replyToDiscordMessage(message, renderSystemCommandHelp());
      return;
    }

    if (text === "/cancel") {
      console.log(
        `[discord] system command /cancel from user=${message.author.id} channel=${message.channelId} session=${sessionKey}`,
      );
      const cancelled = onCancel(sessionKey);
      await replyToDiscordMessage(
        message,
        cancelled ? "已发送取消请求。" : "当前会话没有正在运行的任务。",
      );
      return;
    }

    if (text === "/restart") {
      console.log(
        `[discord] system command /restart from user=${message.author.id} channel=${message.channelId}`,
      );
      await replyToDiscordMessage(message, "ClawNeo 正在重启。");
      runDetachedServiceCommand("restart");
      return;
    }

    if (text === "/update") {
      console.log(
        `[discord] system command /update from user=${message.author.id} channel=${message.channelId}`,
      );
      await replyToDiscordMessage(message, "ClawNeo 正在后台升级到最新版本，完成后会自动重启。");
      runDetachedUpdateCommand();
      return;
    }

    if (text === "/stop") {
      console.log(
        `[discord] system command /stop from user=${message.author.id} channel=${message.channelId}`,
      );
      await replyToDiscordMessage(message, "ClawNeo 正在停止，稍后将离线。");
      runDetachedServiceCommand("stop");
      return;
    }

    if (text.startsWith("/")) {
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
