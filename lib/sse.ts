export interface SseMessage {
  event: string;
  data: unknown;
}

export interface SseParseResult {
  messages: SseMessage[];
  remainder: string;
}

export function parseSseBuffer(input: string): SseParseResult {
  const normalized = input.replace(/\r\n/g, "\n");
  const frames = normalized.split("\n\n");
  const remainder = frames.pop() ?? "";

  const messages = frames.flatMap((frame) => {
    let event = "";
    const dataLines: string[] = [];

    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }

    if (!event || dataLines.length === 0) return [];

    try {
      return [{ event, data: JSON.parse(dataLines.join("\n")) }];
    } catch {
      return [];
    }
  });

  return { messages, remainder };
}
