import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveOpenRouterWithModelOverride } from "@/lib/settings";
import {
  OPENROUTER_CHAT_COMPLETIONS_URL,
  buildMultiTurnMessages,
  buildStreamRequestBody,
  CHAT_SYSTEM_PROMPT,
  iterateOpenRouterSse,
} from "@/lib/openrouter-chat";

const MAX_USER_CONTENT = 32000;
const MAX_CONTEXT_MESSAGES = 40;
const MAX_CONTEXT_CHARS = 100_000;

type RouteCtx = { params: Promise<{ id: string }> };

function sliceContextMessages(
  messages: { role: string; content: string }[]
): { role: string; content: string }[] {
  let slice = messages.slice(-MAX_CONTEXT_MESSAGES);
  let charCount = slice.reduce((n, m) => n + m.content.length, 0);
  while (charCount > MAX_CONTEXT_CHARS && slice.length > 1) {
    slice = slice.slice(1);
    charCount = slice.reduce((n, m) => n + m.content.length, 0);
  }
  return slice;
}

function sseEncode(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(request: NextRequest, context: RouteCtx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await context.params;

  const chatSession = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  });
  if (!chatSession) {
    return NextResponse.json({ message: "Chat not found" }, { status: 404 });
  }

  let body: { content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const content =
    typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json(
      { message: "Message cannot be empty" },
      { status: 400 }
    );
  }
  if (content.length > MAX_USER_CONTENT) {
    return NextResponse.json(
      { message: "Message exceeds maximum length" },
      { status: 400 }
    );
  }

  const resolved = await resolveOpenRouterWithModelOverride(
    session.user.id,
    chatSession.modelId
  );
  if (!resolved) {
    return NextResponse.json(
      {
        message:
          "OpenRouter is not configured. In Settings, choose a vault secret (your API key) and a default free model, or set a model for this chat.",
      },
      { status: 503 }
    );
  }

  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content,
    },
  });

  if (chatSession.title === "New chat") {
    const title = content.split("\n")[0]?.trim().slice(0, 80) || "Chat";
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title, updatedAt: new Date() },
    });
  } else {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  }

  const dbMessages = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const contextTurns = sliceContextMessages(dbMessages);
  const orMessages = buildMultiTurnMessages(
    resolved.model,
    contextTurns,
    CHAT_SYSTEM_PROMPT
  );
  // `stream: true` in body → OpenRouter streams SSE chunks (see buildStreamRequestBody).
  const requestBody = buildStreamRequestBody(resolved.model, orMessages, {
    temperature: 0.7,
    max_tokens: 4096,
  });

  const { apiKey, referer } = resolved;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullAssistant = "";
      try {
        const orRes = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            /** Ask for the SSE stream explicitly (OpenAI-style streaming). */
            Accept: "text/event-stream",
            "HTTP-Referer": referer,
            "X-OpenRouter-Title": "OmniDesk Chat",
          },
          body: JSON.stringify(requestBody),
          signal: request.signal,
        });

        if (!orRes.ok || !orRes.body) {
          const text = await orRes.text();
          let msg = `OpenRouter error (${orRes.status})`;
          try {
            const j = JSON.parse(text) as { error?: { message?: string } };
            if (j.error?.message) msg = j.error.message;
          } catch {
            if (text) msg = text.slice(0, 500);
          }
          controller.enqueue(sseEncode({ type: "error", message: msg }));
          controller.close();
          return;
        }

        for await (const chunk of iterateOpenRouterSse(orRes.body)) {
          if (chunk.type === "delta") {
            fullAssistant += chunk.text;
            controller.enqueue(sseEncode({ type: "token", text: chunk.text }));
          } else if (chunk.type === "error") {
            controller.enqueue(
              sseEncode({ type: "error", message: chunk.message })
            );
            controller.close();
            return;
          }
        }

        const trimmed = fullAssistant.trim();
        if (trimmed) {
          await prisma.chatMessage.create({
            data: {
              sessionId,
              role: "assistant",
              content: fullAssistant,
            },
          });
        }
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        });

        controller.enqueue(sseEncode({ type: "complete" }));
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Stream failed";
        try {
          controller.enqueue(sseEncode({ type: "error", message }));
        } catch {
          /* stream may be errored */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
