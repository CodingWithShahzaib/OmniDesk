/** Browser-side parser for OmniDesk chat API SSE (`data: {JSON}\\n\\n`). */

export type AppChatSseEvent =
  | { type: "token"; text: string }
  | { type: "error"; message: string }
  | { type: "complete" };

export function parseAppChatSseBuffer(buffer: string): {
  events: AppChatSseEvent[];
  rest: string;
} {
  const events: AppChatSseEvent[] = [];
  const segments = buffer.split(/\r?\n\r?\n/);
  const rest = segments.pop() ?? "";
  for (const block of segments) {
    const lines = block.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trimStart();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          type?: string;
          text?: string;
          message?: string;
        };
        if (parsed.type === "token" && typeof parsed.text === "string") {
          events.push({ type: "token", text: parsed.text });
        } else if (parsed.type === "error") {
          events.push({
            type: "error",
            message:
              typeof parsed.message === "string"
                ? parsed.message
                : "Stream error",
          });
        } else if (parsed.type === "complete") {
          events.push({ type: "complete" });
        }
      } catch {
        /* partial JSON across chunks — wait for more */
      }
    }
  }
  return { events, rest };
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const c = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      c.abort(s.reason);
      return c.signal;
    }
    s.addEventListener("abort", () => c.abort(s.reason), { once: true });
  }
  return c.signal;
}

/**
 * POSTs a user message and yields assistant token strings from the app’s SSE stream.
 * Use `mergeAbortSignals([parent, local])` from the caller when the effect needs its own cleanup.
 */
export async function* streamAppChatMessages(
  sessionId: string,
  content: string,
  signal: AbortSignal
): AsyncGenerator<string, void, undefined> {
  const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ content }),
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `Request failed (${res.status})`;
    try {
      const j = JSON.parse(text) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      if (text) msg = text.slice(0, 300);
    }
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseAppChatSseBuffer(buffer);
      buffer = rest;
      for (const ev of events) {
        if (ev.type === "token") {
          yield ev.text;
        } else if (ev.type === "error") {
          throw new Error(ev.message);
        } else if (ev.type === "complete") {
          return;
        }
      }
    }
    if (buffer.trim()) {
      const { events } = parseAppChatSseBuffer(buffer + "\n\n");
      for (const ev of events) {
        if (ev.type === "token") yield ev.text;
        else if (ev.type === "error") throw new Error(ev.message);
        else if (ev.type === "complete") return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export { mergeAbortSignals };
