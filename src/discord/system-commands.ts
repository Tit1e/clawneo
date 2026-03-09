import type {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  Message,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { SlashCommandBuilder } from "discord.js";
import { collectStatusSnapshot, renderStatusPlainText } from "../cli/status.js";
import { runDetachedServiceCommand, runDetachedUpdateCommand } from "../cli/service-manager.js";
import { resolveSessionKey } from "../core/session-key.js";
import type { AppConfig, InboundMessage } from "../core/types.js";
import { sendChunkedDiscordReply } from "./reply.js";

type SystemCommandContext = {
  config: AppConfig;
  command: string;
  userId: string;
  guildId?: string;
  channelId: string;
  threadId?: string;
  reply: (content: string) => Promise<void>;
  onCancel: (sessionKey: string) => boolean;
};

function canSendMessage(channel: Message["channel"]): channel is Message["channel"] & {
  send: (content: string) => Promise<unknown>;
} {
  return typeof (channel as { send?: unknown }).send === "function";
}

function toSessionKeyParts(
  context: Pick<SystemCommandContext, "userId" | "guildId" | "channelId" | "threadId">,
): Omit<InboundMessage, "sessionKey"> {
  return {
    messageId: "system-command",
    platform: "discord",
    userId: context.userId,
    guildId: context.guildId,
    channelId: context.channelId,
    threadId: context.threadId,
    text: "",
    createdAt: new Date().toISOString(),
  };
}

export function renderSystemCommandHelp(): string {
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

export async function handleSystemCommand(context: SystemCommandContext): Promise<boolean> {
  const command = context.command.trim().toLowerCase();
  const sessionKey = resolveSessionKey(toSessionKeyParts(context));

  if (command === "status") {
    const statusText = renderStatusPlainText(collectStatusSnapshot());
    await context.reply(statusText);
    return true;
  }

  if (command === "help") {
    await context.reply(renderSystemCommandHelp());
    return true;
  }

  if (command === "cancel") {
    const cancelled = context.onCancel(sessionKey);
    await context.reply(cancelled ? "已发送取消请求。" : "当前会话没有正在运行的任务。");
    return true;
  }

  if (command === "restart") {
    await context.reply("ClawNeo 正在重启。");
    runDetachedServiceCommand("restart");
    return true;
  }

  if (command === "update") {
    await context.reply("ClawNeo 正在后台升级到最新版本，完成后会自动重启。");
    runDetachedUpdateCommand();
    return true;
  }

  if (command === "stop") {
    await context.reply("ClawNeo 正在停止，稍后将离线。");
    runDetachedServiceCommand("stop");
    return true;
  }

  return false;
}

export function createSlashCommandDefinitions(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [
    new SlashCommandBuilder().setName("help").setDescription("查看 ClawNeo 系统命令说明"),
    new SlashCommandBuilder().setName("status").setDescription("查看当前 ClawNeo 服务状态"),
    new SlashCommandBuilder().setName("cancel").setDescription("取消当前会话正在运行的任务"),
    new SlashCommandBuilder().setName("update").setDescription("升级到最新版本并自动重启服务"),
    new SlashCommandBuilder().setName("restart").setDescription("重启当前 ClawNeo 服务"),
    new SlashCommandBuilder().setName("stop").setDescription("停止当前 ClawNeo 服务"),
  ].map((builder) => builder.toJSON());
}

export async function registerSlashCommands(client: Client, config: AppConfig): Promise<void> {
  if (!client.application) {
    return;
  }

  const definitions = createSlashCommandDefinitions();
  if (config.discord.allowedGuildIds.length > 0) {
    for (const guildId of config.discord.allowedGuildIds) {
      await client.application.commands.set(definitions, guildId);
    }
    console.log(`[discord] registered slash commands for guilds: ${config.discord.allowedGuildIds.join(", ")}`);
    return;
  }

  await client.application.commands.set(definitions);
  console.log("[discord] registered global slash commands");
}

export async function replyToDiscordMessage(message: Message, content: string): Promise<void> {
  if (canSendMessage(message.channel)) {
    const channel = message.channel;
    await sendChunkedDiscordReply(content, (chunk) => channel.send(chunk));
    return;
  }
  await sendChunkedDiscordReply(content, (chunk) => message.reply(chunk));
}

export async function replyToInteraction(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
  const options: InteractionReplyOptions = {
    content,
    ephemeral: true,
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(options);
    return;
  }

  await interaction.reply(options);
}
