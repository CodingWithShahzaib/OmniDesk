import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserSettings, upsertUserSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const settings = await getUserSettings(session.user.id);
  return NextResponse.json({
    openRouterModelId: settings?.openRouterModelId ?? null,
    openRouterSecretId: settings?.openRouterSecretId ?? null,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: {
    openRouterModelId?: string | null;
    openRouterSecretId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const secretId =
    body.openRouterSecretId === undefined
      ? undefined
      : body.openRouterSecretId === null || body.openRouterSecretId === ""
        ? null
        : body.openRouterSecretId.trim();

  if (secretId) {
    const secret = await prisma.secret.findFirst({
      where: { id: secretId, userId: session.user.id },
      select: { id: true },
    });
    if (!secret) {
      return NextResponse.json(
        { message: "Selected vault secret was not found." },
        { status: 400 }
      );
    }
  }

  const modelId =
    body.openRouterModelId === undefined
      ? undefined
      : body.openRouterModelId === null || body.openRouterModelId === ""
        ? null
        : body.openRouterModelId.trim();

  const updated = await upsertUserSettings(session.user.id, {
    ...(modelId !== undefined && { openRouterModelId: modelId }),
    ...(secretId !== undefined && { openRouterSecretId: secretId }),
  });

  return NextResponse.json(updated);
}
