export type AppConfig = {
  discord: {
    token: string;
    allowedUserIds: string[];
    allowedGuildIds: string[];
  };
  agent: {
    model: string;
    workspaceRoot: string;
    toolCwd: string;
    userProfilePath: string;
  };
  runtime: {
    stateDir: string;
    configPath: string;
    dbPath: string;
    transcriptDir: string;
    authStorePath: string;
    skillsDirs: string[];
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

export type ToolExecutionRecord = {
  toolName: string;
  content: string;
  rawContent: string;
  isError: boolean;
};

export type PendingCommandApproval = {
  sessionKey: string;
  userId: string;
  command: string;
  createdAt: string;
};

export type ModelReplyResult = {
  reply: string;
  toolEvents: ToolExecutionRecord[];
};
