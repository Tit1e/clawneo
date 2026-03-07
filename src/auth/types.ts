export type AuthProfileCredential =
  | {
      type: "oauth";
      provider: "openai-codex";
      access: string;
      refresh: string;
      expires: number;
      email?: string;
      accountId?: string;
    }
  | {
      type: "token";
      provider: "openai-codex";
      token: string;
      expires?: number;
      email?: string;
      accountId?: string;
    };

export type AuthProfileStore = {
  version: 1;
  profiles: Record<string, AuthProfileCredential>;
  defaultProfileId?: string;
};
