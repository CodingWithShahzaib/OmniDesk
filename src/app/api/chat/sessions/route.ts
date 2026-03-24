import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const list = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      modelId: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: unknown; modelId?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const titleRaw =
    typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const modelIdRaw =
    body.modelId === null || body.modelId === ""
      ? null
      : typeof body.modelId === "string"
        ? body.modelId.trim() || null
        : undefined;

  const created = await prisma.chatSession.create({
    data: {
      userId: session.user.id,
      title: titleRaw || "New chat",
      modelId: modelIdRaw === undefined ? null : modelIdRaw,
    },
    select: {
      id: true,
      title: true,
      modelId: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(created);
}
