const MAX_SUMMARY_LINES = 24;
const MAX_SUMMARY_CHARS = 1600;
const MAX_PREVIEW_LINE_LENGTH = 240;

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function truncateLine(line: string, limit = MAX_PREVIEW_LINE_LENGTH): string {
  if (line.length <= limit) {
    return line;
  }
  return `${line.slice(0, Math.max(0, limit - 1))}…`;
}

function finalizeSummary(lines: string[]): string {
  const joined = lines.join("\n").trim();
  if (joined.length <= MAX_SUMMARY_CHARS) {
    return joined;
  }
  return `${joined.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…`;
}

function summarizePlainText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "(no output)";
  }

  const lines = normalized.split("\n");
  const previewLines = lines.slice(0, MAX_SUMMARY_LINES).map((line) => truncateLine(line));
  const summaryLines: string[] = [];

  summaryLines.push(`lines: ${lines.length}`);
  summaryLines.push("");
  summaryLines.push(...previewLines);

  if (lines.length > MAX_SUMMARY_LINES) {
    summaryLines.push("", `... truncated ${lines.length - MAX_SUMMARY_LINES} more lines`);
  }

  return finalizeSummary(summaryLines);
}

function summarizeStructuredContent(content: Array<{ type?: string; text?: string }>): string {
  const textParts = content
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text!.trim())
    .filter(Boolean);

  if (textParts.length === 0) {
    return "(no textual output)";
  }

  return summarizePlainText(textParts.join("\n"));
}

function summarizeJsonPayload(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (
    "content" in parsed &&
    Array.isArray((parsed as { content?: unknown }).content)
  ) {
    return summarizeStructuredContent(
      (parsed as { content: Array<{ type?: string; text?: string }> }).content,
    );
  }

  return null;
}

export function summarizeToolOutput(raw: string): string {
  const normalized = raw.trim();
  if (!normalized) {
    return "(no output)";
  }

  const parsed = safeJsonParse(normalized);
  const structuredSummary = summarizeJsonPayload(parsed);
  if (structuredSummary) {
    return structuredSummary;
  }

  return summarizePlainText(normalized);
}

