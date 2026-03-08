import fs from "node:fs";
import type { UserPreferences } from "../core/types.js";

type ManagedPreference = {
  key: string;
  label: string;
  format: (value: unknown) => string;
};

const MANAGED_PREFERENCES: ManagedPreference[] = [
  {
    key: "response_language",
    label: "Preferred language",
    format: (value) => {
      if (value === "zh-CN") {
        return "Simplified Chinese";
      }
      if (value === "en-US") {
        return "English";
      }
      return String(value);
    },
  },
  {
    key: "answer_style",
    label: "Preferred answer style",
    format: (value) => String(value),
  },
  {
    key: "package_manager",
    label: "Preferred package manager",
    format: (value) => String(value),
  },
  {
    key: "shell",
    label: "Shell",
    format: (value) => String(value),
  },
  {
    key: "edit_policy",
    label: "Edit policy",
    format: (value) => {
      if (value === "ask_before_modify") {
        return "ask before modifying files";
      }
      if (value === "auto_apply") {
        return "apply directly";
      }
      return String(value);
    },
  },
];

const MANAGED_BLOCK_START = "<!-- clawneo:preferences:start -->";
const MANAGED_BLOCK_END = "<!-- clawneo:preferences:end -->";

function buildManagedLines(preferences: UserPreferences): string[] {
  return MANAGED_PREFERENCES.flatMap(({ key, label, format }) => {
    if (!(key in preferences)) {
      return [];
    }
    return [`- ${label}: ${format(preferences[key])}`];
  });
}

function ensureUserProfileHeading(lines: string[]): number {
  let headingIndex = lines.findIndex((line) => line.trim() === "# User Profile");
  if (headingIndex !== -1) {
    return headingIndex;
  }

  if (lines.length > 1 || lines[0]?.trim() !== "") {
    if (lines[lines.length - 1]?.trim() !== "") {
      lines.push("");
    }
    lines.push("# User Profile", "");
  } else {
    lines[0] = "# User Profile";
    lines.push("");
  }

  headingIndex = lines.findIndex((line) => line.trim() === "# User Profile");
  return headingIndex;
}

function findNextHeadingIndex(lines: string[], headingIndex: number): number {
  const nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && /^#{1,6}\s+/.test(line.trim()),
  );
  return nextHeadingIndex === -1 ? lines.length : nextHeadingIndex;
}

function ensureManagedBlock(lines: string[], headingIndex: number, nextHeadingIndex: number): void {
  const startIndex = lines.findIndex(
    (line, index) => index > headingIndex && index < nextHeadingIndex && line.trim() === MANAGED_BLOCK_START,
  );
  const endIndex = lines.findIndex(
    (line, index) => index > headingIndex && index < nextHeadingIndex && line.trim() === MANAGED_BLOCK_END,
  );
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    return;
  }

  let insertAt = headingIndex + 1;
  if (insertAt < lines.length && lines[insertAt].trim() === "") {
    insertAt += 1;
  }

  lines.splice(insertAt, 0, MANAGED_BLOCK_START, MANAGED_BLOCK_END);
}

function replaceManagedBlock(lines: string[], managedLines: string[]): void {
  const startIndex = lines.findIndex((line) => line.trim() === MANAGED_BLOCK_START);
  const endIndex = lines.findIndex((line, index) => index > startIndex && line.trim() === MANAGED_BLOCK_END);
  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    throw new Error("Managed USER.md preference block is missing or malformed.");
  }

  lines.splice(startIndex + 1, endIndex - startIndex - 1, ...managedLines);
}

export function syncUserProfileFile(userProfilePath: string, preferences: UserPreferences): void {
  const managedLines = buildManagedLines(preferences);
  if (managedLines.length === 0) {
    return;
  }

  const existingContent = fs.existsSync(userProfilePath)
    ? fs.readFileSync(userProfilePath, "utf8")
    : "# User Profile\n";
  const normalizedContent = existingContent.replace(/\r\n/g, "\n");
  const lines = normalizedContent.split("\n");

  const headingIndex = ensureUserProfileHeading(lines);
  const nextHeadingIndex = findNextHeadingIndex(lines, headingIndex);
  ensureManagedBlock(lines, headingIndex, nextHeadingIndex);
  replaceManagedBlock(lines, managedLines);

  const output = `${lines.join("\n").replace(/\n+$/g, "")}\n`;
  fs.writeFileSync(userProfilePath, output, "utf8");
}
