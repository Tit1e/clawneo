export type AppConfig = {
  discord: {
    token: string;
    allowedUserIds: string[];
    allowedChannelIds: string[];
  };
  agent: {
    model: string;
    workspaceRoot: string;
    userProfilePath: string;
  };
  runtime: {
    dbPath: string;
    transcriptDir: string;
    authStorePath: string;
  };
};

export type InboundMessage = {
  messageId: string;
  platform: "discord";
  userId: string;
  guildId?: string;
  channelId: string;
  threadId?: string;
  sessionKey: string;
  text: string;
  createdAt: string;
  reply?: (content: string) => Promise<unknown>;
};

export type StoredMessage = {
  id: string;
  sessionKey: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: unknown;
  createdAt: string;
};

export type UserPreferences = Record<string, unknown>;
