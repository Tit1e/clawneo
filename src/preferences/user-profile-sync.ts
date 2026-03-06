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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildManagedLines(preferences: UserPreferences): string[] {
  return MANAGED_PREFERENCES.flatMap(({ key, label, format }) => {
    if (!(key in preferences)) {
      return [];
    }
    return [`- ${label}: ${format(preferences[key])}`];
  });
}

function upsertManagedLine(lines: string[], headingIndex: number, nextHeadingIndex: number, line: string): void {
  const label = line.slice(2, line.indexOf(":"));
  const matcher = new RegExp(`^- ${escapeRegExp(label)}:.*$`);

  for (let index = 0; index < lines.length; index += 1) {
    if (matcher.test(lines[index])) {
      lines[index] = line;
      return;
    }
  }

  let insertAt = headingIndex + 1;
  if (insertAt < lines.length && lines[insertAt].trim() === "") {
    insertAt += 1;
  }
  while (insertAt < nextHeadingIndex && lines[insertAt].startsWith("- ")) {
    insertAt += 1;
  }
  lines.splice(insertAt, 0, line);
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
  const endsWithNewline = normalizedContent.endsWith("\n");
  const lines = normalizedContent.split("\n");

  let headingIndex = lines.findIndex((line) => line.trim() === "# User Profile");
  if (headingIndex === -1) {
    if (lines.length > 1 || lines[0].trim() !== "") {
      if (lines[lines.length - 1].trim() !== "") {
        lines.push("");
      }
      lines.push("# User Profile", "");
    } else {
      lines[0] = "# User Profile";
      lines.push("");
    }
    headingIndex = lines.findIndex((line) => line.trim() === "# User Profile");
  }

  let nextHeadingIndex = lines.findIndex(
    (line, index) => index > headingIndex && /^#{1,6}\s+/.test(line.trim()),
  );
  if (nextHeadingIndex === -1) {
    nextHeadingIndex = lines.length;
  }

  for (const line of managedLines) {
    upsertManagedLine(lines, headingIndex, nextHeadingIndex, line);
    nextHeadingIndex = lines.findIndex(
      (entry, index) => index > headingIndex && /^#{1,6}\s+/.test(entry.trim()),
    );
    if (nextHeadingIndex === -1) {
      nextHeadingIndex = lines.length;
    }
  }

  const output = lines.join("\n").replace(/\n+$/g, "") + (endsWithNewline ? "\n" : "\n");
  fs.writeFileSync(userProfilePath, output, "utf8");
}
