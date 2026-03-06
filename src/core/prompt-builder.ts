import fs from "node:fs";
import type { AppConfig, StoredMessage, UserPreferences } from "./types.js";

type PromptContextParams = {
  config: AppConfig;
  preferences: UserPreferences;
  transcript: StoredMessage[];
};

export function buildPromptContext({ config, preferences, transcript }: PromptContextParams) {
  const preferenceLines = Object.entries(preferences).map(([key, value]) => `- ${key}: ${value}`);
  let userProfile = "";

  try {
    userProfile = fs.readFileSync(config.agent.userProfilePath, "utf8").trim();
  } catch {}

  return {
    systemPrompt: [
      "You are MiniClaw, a personal Discord assistant.",
      "Keep replies concise and useful.",
      preferenceLines.length > 0 ? `User preferences:\n${preferenceLines.join("\n")}` : "",
      userProfile ? `USER.md:\n${userProfile}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    transcript,
  };
}
