export type AuthProfileCredential =
  | {
      type: "oauth";
      provider: "openai-codex";
      access: string;
      refresh: string;
      expires: number;
      email?: string;
    }
  | {
      type: "token";
      provider: "openai-codex";
      token: string;
      expires?: number;
      email?: string;
    };

export type AuthProfileStore = {
  version: 1;
  profiles: Record<string, AuthProfileCredential>;
};
