import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveOpenRouterForUser } from "@/lib/settings";
import {
  OPENROUTER_CHAT_COMPLETIONS_URL,
  buildNonStreamRequestBody,
  buildSingleTurnMessages,
  parseCompletionResponse,
} from "@/lib/openrouter-chat";

const SYSTEM_PROMPT =
  "You help software and knowledge workers fill timesheet bullet lists. Be specific and plausible; never invent confidential names beyond what the user provided. When prior entries are given, mirror their writing style, vocabulary, and bullet granularity.";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [0, 450, 1100];

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveOpenRouterForUser(session.user.id);
  if (!resolved) {
    return NextResponse.json(
      {
        message:
          "OpenRouter is not configured. In Settings, choose a vault secret (your API key) and a free model.",
      },
      { status: 503 }
    );
  }
  const { apiKey, model, referer } = resolved;

  let body: {
    taskDetails?: string;
    date?: string;
    previousEntries?: Array<{
      taskDetails?: string;
      taskBullets?: string;
      date?: string;
    }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const taskDetails = (body.taskDetails ?? "").trim();
  if (!taskDetails) {
    return NextResponse.json(
      { message: "Enter a task or project name first so the AI has context." },
      { status: 400 }
    );
  }

  const dateHint = (body.date ?? "").trim();
  let dateLine = "";
  if (dateHint) {
    const [y, m, d] = dateHint.split("-").map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      dateLine = dt.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

  const rawPrev = Array.isArray(body.previousEntries) ? body.previousEntries : [];
  const previousBlock = rawPrev
    .map((e) => {
      const td = (e.taskDetails ?? "").trim();
      const tb = (e.taskBullets ?? "").trim();
      if (!td && !tb) return null;
      const ds = (e.date ?? "").trim().slice(0, 10);
      const header = ds ? `[${ds}] ${td || "(no project name)"}` : td || "(no project name)";
      return `${header}\n${tb || "(no bullets)"}`;
    })
    .filter(Boolean)
    .join("\n\n---\n\n");

  const userPrompt = [
    previousBlock
      ? [
          "Here are earlier timesheet entries from this user (match their tone, level of detail, and bullet style; write NEW work for the date below, do not copy these lines):",
          "",
          previousBlock,
          "",
          "---",
          "",
        ].join("\n")
      : null,
    `Project / task name: ${taskDetails}`,
    dateLine ? `Work date: ${dateLine}` : null,
    "",
    "Write exactly 4–5 bullet points for a daily timesheet: concrete, professional, first-person past tense (what was done today).",
    "Output plain text only: one bullet per line. Each line must start with the character • followed by a space.",
    "Do not add a title, numbering, or markdown fences.",
  ]
    .filter(Boolean)
    .join("\n");

  const messages = buildSingleTurnMessages(model, SYSTEM_PROMPT, userPrompt);
  const requestBody = buildNonStreamRequestBody(model, messages, {
    temperature: 0.6,
    max_tokens: 600,
  });

  let lastMessage = "AI request failed.";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS[attempt] ?? 1000);
    }

    const res = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-OpenRouter-Title": "OmniDesk Timesheet",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await res.text();
    let payload: unknown;
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      console.error("OpenRouter: invalid JSON", res.status, responseText.slice(0, 500));
      lastMessage = "AI request returned invalid data. Try again.";
      if (attempt < MAX_ATTEMPTS - 1) continue;
      return NextResponse.json({ message: lastMessage }, { status: 502 });
    }

    const parsed = parseCompletionResponse(res, payload, responseText);
    if (parsed.ok) {
      const lines = parsed.text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          if (line.startsWith("•"))
            return line.startsWith("• ") ? line : `• ${line.slice(1).trim()}`;
          if (line.startsWith("- ")) return `• ${line.slice(2).trim()}`;
          if (/^\d+[.)]\s/.test(line))
            return `• ${line.replace(/^\d+[.)]\s*/, "").trim()}`;
          return `• ${line}`;
        });

      return NextResponse.json({ taskBullets: lines.join("\n") });
    }

    lastMessage = parsed.message;
    console.error(
      `OpenRouter attempt ${attempt + 1}/${MAX_ATTEMPTS}:`,
      lastMessage
    );

    if (!parsed.retryable && attempt === 0) {
      return NextResponse.json({ message: lastMessage }, { status: 502 });
    }
    if (!parsed.retryable) {
      return NextResponse.json({ message: lastMessage }, { status: 502 });
    }
  }

  return NextResponse.json(
    {
      message: `${lastMessage} If this keeps happening, pick another free model (e.g. \`openrouter/free\`) in Settings.`,
    },
    { status: 502 }
  );
}
