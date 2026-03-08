import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSecret, listSecrets } from "@/lib/secrets";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const secrets = await listSecrets(session.user.id);
  return NextResponse.json(secrets);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { name, value, description } = (body || {}) as {
    name?: string;
    value?: string;
    description?: string | null;
  };

  if (!name || !value) {
    return NextResponse.json(
      { message: "Name and value are required" },
      { status: 400 }
    );
  }

  try {
    const secret = await createSecret(session.user.id, {
      name,
      value,
      description,
    });
    return NextResponse.json(secret, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Failed to create secret" },
      { status: 400 }
    );
  }
}
