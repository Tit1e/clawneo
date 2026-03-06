import type { InboundMessage } from "./types.js";

export function resolveSessionKey(message: Omit<InboundMessage, "sessionKey">): string {
  if (message.threadId) {
    return `discord:guild:${message.guildId || "unknown"}:thread:${message.threadId}`;
  }
  if (message.guildId) {
    return `discord:guild:${message.guildId}:channel:${message.channelId}`;
  }
  return `discord:dm:${message.userId}`;
}
