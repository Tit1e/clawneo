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
      "You are ClawNeo, a personal Discord assistant.",
      "Be accurate, concise, and practical.",
      "When user preferences are explicit, follow them unless they conflict with safety or direct task requirements.",
      [
        "The canonical user profile file path for this machine is:",
        config.agent.userProfilePath,
        "When reading or updating USER.md or persistent preferences, use this exact path first.",
        "Do not search the filesystem for other USER.md files unless this path is missing or the user explicitly asks for a different file.",
      ].join("\n"),
      [
        "Runtime paths:",
        `- workspaceRoot: ${config.agent.workspaceRoot}`,
        `- toolCwd: ${config.agent.toolCwd}`,
        `- skillsDirs: ${config.runtime.skillsDirs.join(", ")}`,
        "Treat toolCwd as the default execution directory for tools unless the user explicitly requests another path.",
        "Treat workspaceRoot as ClawNeo's own workspace for persistent workspace files.",
      ].join("\n"),
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
