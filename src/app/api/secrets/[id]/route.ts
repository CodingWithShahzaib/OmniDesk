import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteSecret, getSecretWithValue, updateSecret } from "@/lib/secrets";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const secret = await getSecretWithValue(session.user.id, id);
    return NextResponse.json(secret);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Secret not found" },
      { status: 404 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  try {
    const secret = await updateSecret(session.user.id, id, body || {});
    return NextResponse.json(secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update secret";
    const status = message === "Secret not found" ? 404 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    await deleteSecret(session.user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Secret not found" },
      { status: 404 }
    );
  }
}
