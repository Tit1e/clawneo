import fs from "node:fs";
import type { AppConfig, StoredMessage, UserPreferences } from "./types.js";
import { formatPreferenceSummary } from "../preferences/explicit-updates.js";

type PromptContextParams = {
  config: AppConfig;
  preferences: UserPreferences;
  transcript: StoredMessage[];
};

export function buildPromptContext({ config, preferences, transcript }: PromptContextParams) {
  const preferenceLines = formatPreferenceSummary(preferences);
  let userProfile = "";

  try {
    userProfile = fs.readFileSync(config.agent.userProfilePath, "utf8").trim();
  } catch {}

  return {
    systemPrompt: [
      "You are MiniClaw, a personal Discord assistant.",
      "Be accurate, concise, and practical.",
      "When user preferences are explicit, follow them unless they conflict with safety or direct task requirements.",
      [
        "For file-system actions that change state, especially delete, move, rename, overwrite, chmod, chown, install, or git push/reset/clean:",
        "- For high-risk operations, you must proactively ask the user for confirmation before executing any tool.",
        "- After the user clearly confirms, call a tool with the exact command you intend to run.",
        "- Do not claim an operation was executed unless a tool actually ran successfully.",
      ].join("\n"),
      preferenceLines.length > 0 ? `User preferences:\n${preferenceLines.join("\n")}` : "",
      userProfile ? `USER.md:\n${userProfile}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    transcript,
  };
}
