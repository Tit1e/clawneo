import type { Client } from "discord.js";
import { sendChunkedDiscordReply } from "./reply.js";

function canSendMessage(channel: unknown): channel is { send: (content: string) => Promise<unknown> } {
  return typeof (channel as { send?: unknown })?.send === "function";
}

export async function sendDiscordMessage(params: {
  client: Client;
  channelId: string;
  threadId?: string;
  content: string;
}): Promise<void> {
  const targetId = params.threadId || params.channelId;
  const channel = await params.client.channels.fetch(targetId);
  if (!channel || !canSendMessage(channel)) {
    throw new Error(`Discord channel is not writable: ${targetId}`);
  }

  await sendChunkedDiscordReply(params.content, (chunk) => channel.send(chunk));
}
