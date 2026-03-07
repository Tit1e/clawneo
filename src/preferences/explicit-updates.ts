import type { UserPreferences } from "../core/types.js";

export type PreferenceUpdate = {
  key: string;
  value: string;
  source: "explicit_message";
  confidence: number;
};

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasPreferenceIntent(text: string): boolean {
  return hasAny(text, [
    /以后/,
    /默认/,
    /偏好/,
    /习惯/,
    /请记住/,
    /记住这个/,
    /from now on/,
    /by default/,
    /prefer/,
    /preference/,
    /remember this/,
  ]);
}

function hasLanguageIntent(text: string): boolean {
  return (
    hasPreferenceIntent(text) ||
    hasAny(text, [
      /用中文回答/,
      /中文回答/,
      /用英文回答/,
      /英文回答/,
      /reply in chinese/,
      /reply in english/,
      /speak chinese/,
      /speak english/,
    ])
  );
}

function hasAnswerStyleIntent(text: string): boolean {
  return (
    hasPreferenceIntent(text) ||
    hasAny(text, [/回答/, /回复/, /answer/, /reply/])
  );
}

export function detectExplicitPreferenceUpdates(text: string): PreferenceUpdate[] {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const updates: PreferenceUpdate[] = [];

  if (
    hasLanguageIntent(normalized) &&
    hasAny(normalized, [/用中文/, /中文回答/, /简体中文/, /speak chinese/, /reply in chinese/]) &&
    !hasAny(normalized, [/英文/, /english/])
  ) {
    updates.push({
      key: "response_language",
      value: "zh-CN",
      source: "explicit_message",
      confidence: 1,
    });
  }

  if (
    hasLanguageIntent(normalized) &&
    hasAny(normalized, [/用英文/, /英文回答/, /reply in english/, /speak english/])
  ) {
    updates.push({
      key: "response_language",
      value: "en-US",
      source: "explicit_message",
      confidence: 1,
    });
  }

  if (
    hasAnswerStyleIntent(normalized) &&
    hasAny(normalized, [/简洁/, /简短/, /短一点/, /concise/, /brief/])
  ) {
    updates.push({
      key: "answer_style",
      value: "concise",
      source: "explicit_message",
      confidence: 0.95,
    });
  }

  if (
    hasAnswerStyleIntent(normalized) &&
    hasAny(normalized, [/详细/, /详细一点/, /展开/, /detailed/, /more detail/])
  ) {
    updates.push({
      key: "answer_style",
      value: "detailed",
      source: "explicit_message",
      confidence: 0.95,
    });
  }

  if (
    hasPreferenceIntent(normalized) &&
    hasAny(normalized, [/默认用pnpm/, /用pnpm/, /\bpnpm\b/])
  ) {
    updates.push({
      key: "package_manager",
      value: "pnpm",
      source: "explicit_message",
      confidence: 0.95,
    });
  }

  if (
    hasPreferenceIntent(normalized) &&
    hasAny(normalized, [/默认用npm/, /用npm/, /\bnpm\b/])
  ) {
    updates.push({
      key: "package_manager",
      value: "npm",
      source: "explicit_message",
      confidence: 0.95,
    });
  }

  if (
    hasPreferenceIntent(normalized) &&
    hasAny(normalized, [/默认用yarn/, /用yarn/, /\byarn\b/])
  ) {
    updates.push({
      key: "package_manager",
      value: "yarn",
      source: "explicit_message",
      confidence: 0.95,
    });
  }

  if (
    hasAny(normalized, [/先问我/, /先别改/, /不要直接改/, /ask before/, /before modifying/]) &&
    hasAny(normalized, [/改文件/, /修改文件/, /modify files/, /edit files/])
  ) {
    updates.push({
      key: "edit_policy",
      value: "ask_before_modify",
      source: "explicit_message",
      confidence: 1,
    });
  }

  if (
    hasAny(normalized, [/可以直接改/, /直接改文件/, /auto apply/, /apply directly/]) &&
    !hasAny(normalized, [/不要直接改/, /先别改/, /先问我/, /ask before/]) &&
    hasAny(normalized, [/改文件/, /修改文件/, /modify files/, /edit files/])
  ) {
    updates.push({
      key: "edit_policy",
      value: "auto_apply",
      source: "explicit_message",
      confidence: 1,
    });
  }

  if (
    hasPreferenceIntent(normalized) &&
    hasAny(normalized, [/\bzsh\b/, /默认 shell 是 zsh/, /shell 用 zsh/])
  ) {
    updates.push({
      key: "shell",
      value: "zsh",
      source: "explicit_message",
      confidence: 0.95,
    });
  }

  if (
    hasPreferenceIntent(normalized) &&
    hasAny(normalized, [/\bbash\b/, /默认 shell 是 bash/, /shell 用 bash/])
  ) {
    updates.push({
      key: "shell",
      value: "bash",
      source: "explicit_message",
      confidence: 0.95,
    });
  }

  return dedupeByKey(updates);
}

function dedupeByKey(updates: PreferenceUpdate[]): PreferenceUpdate[] {
  const latest = new Map<string, PreferenceUpdate>();
  for (const update of updates) {
    latest.set(update.key, update);
  }
  return [...latest.values()];
}

const DISPLAY_LABELS: Record<string, string> = {
  response_language: "回复语言",
  answer_style: "回答风格",
  package_manager: "包管理器",
  edit_policy: "文件修改策略",
  shell: "Shell",
};

export function formatPreferenceSummary(preferences: UserPreferences): string[] {
  return Object.entries(preferences).map(([key, value]) => {
    const label = DISPLAY_LABELS[key] || key;
    return `- ${label}: ${String(value)}`;
  });
}
