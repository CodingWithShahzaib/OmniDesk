import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSecretWithValue } from "@/lib/secrets";

const MODELS_URL = "https://openrouter.ai/api/v1/models";

type OpenRouterModel = {
  id: string;
  name?: string;
};

/** Full catalog from OpenRouter (free and paid). Chat model picker. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const secretId = request.nextUrl.searchParams.get("secretId")?.trim();
  if (!secretId) {
    return NextResponse.json(
      { message: "Query parameter secretId is required." },
      { status: 400 }
    );
  }

  let apiKey: string;
  try {
    const secret = await getSecretWithValue(session.user.id, secretId);
    apiKey = secret.value.trim();
  } catch {
    return NextResponse.json({ message: "Secret not found." }, { status: 404 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { message: "The selected vault entry has no API key value." },
      { status: 400 }
    );
  }

  const res = await fetch(MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const text = await res.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { message: "OpenRouter returned invalid JSON for /models." },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const err = payload as { error?: { message?: string } };
    const msg =
      err.error?.message ||
      (typeof payload === "object" && payload !== null
        ? JSON.stringify(payload)
        : "Unknown error");
    return NextResponse.json(
      {
        message:
          res.status === 401 || res.status === 403
            ? "OpenRouter rejected this API key. Check the vault secret value."
            : msg,
      },
      { status: 502 }
    );
  }

  const data = payload as { data?: OpenRouterModel[] };
  const rows = Array.isArray(data.data) ? data.data : [];

  const models = rows
    .map((m) => ({
      id: m.id,
      name: (m.name ?? m.id).trim() || m.id,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return NextResponse.json({ models });
}
