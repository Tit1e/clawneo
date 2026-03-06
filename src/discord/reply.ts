const DISCORD_MESSAGE_LIMIT = 2000;

function chunkTextByBreakResolver(
  text: string,
  limit: number,
  resolveBreakIndex: (window: string) => number,
): string[] {
  if (!text) {
    return [];
  }
  if (limit <= 0 || text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    const window = remaining.slice(0, limit);
    const candidateBreak = resolveBreakIndex(window);
    const breakIdx =
      Number.isFinite(candidateBreak) && candidateBreak > 0 && candidateBreak <= limit
        ? candidateBreak
        : limit;

    const rawChunk = remaining.slice(0, breakIdx);
    const chunk = rawChunk.trimEnd();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    const brokeOnSeparator = breakIdx < remaining.length && /\s/.test(remaining[breakIdx] || "");
    const nextStart = Math.min(remaining.length, breakIdx + (brokeOnSeparator ? 1 : 0));
    remaining = remaining.slice(nextStart).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}

function resolveBreakIndex(window: string): number {
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph >= 0) {
    return paragraph + 1;
  }

  const newline = window.lastIndexOf("\n");
  if (newline >= 0) {
    return newline + 1;
  }

  const space = window.lastIndexOf(" ");
  if (space >= 0) {
    return space + 1;
  }

  return window.length;
}

export function chunkDiscordMessage(text: string, limit = DISCORD_MESSAGE_LIMIT): string[] {
  return chunkTextByBreakResolver(text, limit, resolveBreakIndex);
}

export async function sendChunkedDiscordReply(
  text: string,
  reply: (content: string) => Promise<unknown>,
): Promise<void> {
  const chunks = chunkDiscordMessage(text, DISCORD_MESSAGE_LIMIT);
  for (const chunk of chunks) {
    await reply(chunk);
  }
}
