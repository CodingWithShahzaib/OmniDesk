/** OpenRouter chat completions — https://openrouter.ai/docs/quickstart */
export const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export type OpenRouterChatRole = "system" | "user" | "assistant";

export type OpenRouterChatMessage = {
  role: OpenRouterChatRole;
  content: string;
};

export type OpenRouterErrorBody = {
  error?: {
    message?: string;
    code?: number;
    metadata?: Record<string, unknown>;
  };
  message?: string;
};

export function normalizeAssistantContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type: string }).type === "text" &&
          "text" in part &&
          typeof (part as { text: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function formatOpenRouterError(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const e = err as { message?: string; metadata?: Record<string, unknown> };
  let s = e.message || "Unknown error";
  const m = e.metadata;
  if (m && typeof m === "object") {
    if (typeof m.provider_name === "string")
      s += ` [provider: ${m.provider_name}]`;
    if (m.raw != null) {
      const raw =
        typeof m.raw === "string" ? m.raw : JSON.stringify(m.raw);
      s += raw.length > 0 && raw.length < 500 ? ` — ${raw}` : "";
    }
  }
  return s;
}

function useMergedSystemUser(modelId: string): boolean {
  return (
    modelId.startsWith("google/") ||
    modelId.includes("gemini") ||
    modelId.includes("gemma")
  );
}

/** Single system + user turn (e.g. timesheet). */
export function buildSingleTurnMessages(
  modelId: string,
  systemPrompt: string,
  userContent: string
): OpenRouterChatMessage[] {
  if (useMergedSystemUser(modelId)) {
    return [
      {
        role: "user",
        content: `Instructions (follow strictly):\n${systemPrompt}\n\n---\n\n${userContent}`,
      },
    ];
  }
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
}

/** Multi-turn chat: optional default system; Gemini/Gemma merge rule for system. */
export function buildMultiTurnMessages(
  modelId: string,
  turns: Array<{ role: string; content: string }>,
  defaultSystem?: string
): OpenRouterChatMessage[] {
  const systemFromTurns = turns
    .filter((t) => t.role === "system")
    .map((t) => t.content)
    .join("\n\n");
  const system =
    [defaultSystem?.trim(), systemFromTurns].filter(Boolean).join("\n\n") ||
    undefined;
  const nonSystem = turns.filter((t) => t.role !== "system");

  if (!useMergedSystemUser(modelId)) {
    const out: OpenRouterChatMessage[] = [];
    if (system) out.push({ role: "system", content: system });
    for (const t of nonSystem) {
      if (t.role === "user" || t.role === "assistant") {
        out.push({ role: t.role, content: t.content });
      }
    }
    return out;
  }

  const out: OpenRouterChatMessage[] = [];
  let firstUser = true;
  for (const t of nonSystem) {
    if (t.role === "user") {
      if (firstUser && system) {
        out.push({
          role: "user",
          content: `Instructions (follow strictly):\n${system}\n\n---\n\n${t.content}`,
        });
        firstUser = false;
      } else {
        out.push({ role: "user", content: t.content });
        firstUser = false;
      }
    } else if (t.role === "assistant") {
      out.push({ role: "assistant", content: t.content });
    }
  }
  return out;
}

export function buildNonStreamRequestBody(
  modelId: string,
  messages: OpenRouterChatMessage[],
  options: { temperature?: number; max_tokens?: number }
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.max_tokens ?? 600,
  };
  if (modelId.toLowerCase() !== "openrouter/free") {
    base.models = [modelId, "openrouter/free"];
    base.route = "fallback";
  }
  return base;
}

/**
 * OpenRouter chat completions with **streaming** enabled.
 * `stream: true` makes the API return Server-Sent Events (SSE): `data: {...}\n\n`
 * chunks with incremental `choices[0].delta.content` tokens — same contract as OpenAI.
 * @see https://openrouter.ai/docs/api-reference/streaming
 */
export function buildStreamRequestBody(
  modelId: string,
  messages: OpenRouterChatMessage[],
  options: { temperature?: number; max_tokens?: number }
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    model: modelId,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 4096,
    /** Required for token-by-token SSE; omit or false = single JSON response. */
    stream: true,
  };
  if (modelId.toLowerCase() !== "openrouter/free") {
    base.models = [modelId, "openrouter/free"];
    base.route = "fallback";
  }
  return base;
}

export type CompletionParse =
  | { ok: true; text: string }
  | { ok: false; message: string; retryable: boolean };

export function parseCompletionResponse(
  res: Response,
  payload: unknown,
  responseText: string
): CompletionParse {
  const errBody = payload as OpenRouterErrorBody;

  if (!res.ok) {
    const upstream =
      errBody.error?.message ||
      errBody.message ||
      formatOpenRouterError(errBody.error) ||
      responseText.slice(0, 800);
    const retryable = [429, 502, 503, 504].includes(res.status);
    return {
      ok: false,
      message:
        res.status === 401 || res.status === 403
          ? "OpenRouter rejected the API key. Check the vault secret in Settings."
          : upstream,
      retryable,
    };
  }

  const data = payload as {
    error?: { message?: string; metadata?: Record<string, unknown> };
    choices?: Array<{
      message?: { content?: unknown };
      error?: { message?: string; metadata?: Record<string, unknown> };
      finish_reason?: string | null;
      native_finish_reason?: string | null;
    }>;
  };

  if (data.error?.message) {
    const msg = formatOpenRouterError(data.error);
    const retryable =
      /provider returned error|rate|timeout|temporarily|unavailable|502|503/i.test(
        msg
      );
    return { ok: false, message: msg, retryable };
  }

  const choice = data.choices?.[0];
  if (choice?.error?.message) {
    const msg = formatOpenRouterError(choice.error);
    return {
      ok: false,
      message: msg,
      retryable: /provider returned error|rate|timeout/i.test(msg),
    };
  }

  const finish =
    choice?.finish_reason ?? choice?.native_finish_reason ?? "";
  if (finish === "error" || finish === "content_filter") {
    const msg =
      formatOpenRouterError(data.error) ||
      choice?.error?.message ||
      `Model finished with ${finish}. Try again or pick another free model in Settings.`;
    return {
      ok: false,
      message: msg,
      retryable: finish === "error",
    };
  }

  const raw = normalizeAssistantContent(choice?.message?.content).trim();
  if (raw) {
    return { ok: true, text: raw };
  }

  return {
    ok: false,
    message:
      "The model returned no text (warm-up or provider issue). Retrying often helps; otherwise choose another free model in Settings.",
    retryable: true,
  };
}

export type StreamChunkParse =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export function parseStreamSseDataLine(dataLine: string): StreamChunkParse | null {
  const trimmed = dataLine.trim();
  if (!trimmed) return null;
  if (trimmed === "[DONE]") return { type: "done" };

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const obj = json as {
    error?: { message?: string; metadata?: Record<string, unknown> };
    choices?: Array<{
      delta?: { content?: unknown };
      message?: { content?: unknown };
    }>;
  };

  if (obj.error) {
    return { type: "error", message: formatOpenRouterError(obj.error) };
  }

  const choice = obj.choices?.[0];
  const delta = choice?.delta?.content;
  if (delta !== undefined && delta !== null) {
    const text =
      typeof delta === "string"
        ? delta
        : normalizeAssistantContent(delta);
    if (text) return { type: "delta", text };
  }

  const deltaObj = choice?.delta;
  if (
    deltaObj &&
    typeof deltaObj === "object" &&
    !Array.isArray(deltaObj) &&
    "text" in deltaObj &&
    typeof (deltaObj as { text: unknown }).text === "string"
  ) {
    const t = (deltaObj as { text: string }).text;
    if (t) return { type: "delta", text: t };
  }

  const msgDelta = choice?.message?.content;
  if (msgDelta !== undefined && msgDelta !== null) {
    const text =
      typeof msgDelta === "string"
        ? msgDelta
        : normalizeAssistantContent(msgDelta);
    if (text) return { type: "delta", text };
  }

  return null;
}

export async function* iterateOpenRouterSse(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamChunkParse, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trimStart();
        if (!t.startsWith("data:")) continue;
        const raw = t.slice(5).trimStart();
        const parsed = parseStreamSseDataLine(raw);
        if (parsed) yield parsed;
      }
    }
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        const t = line.trimStart();
        if (!t.startsWith("data:")) continue;
        const parsed = parseStreamSseDataLine(t.slice(5).trimStart());
        if (parsed) yield parsed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const CHAT_SYSTEM_PROMPT =
  "You are a helpful assistant. Be concise unless the user asks for detail.";
