import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteCtx) {
  const session = await auth.api.getSession({ headers: _request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const chatSession = await prisma.chatSession.findFirst({
    where: { id, userId: session.user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  if (!chatSession) {
    return NextResponse.json({ message: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: chatSession.id,
    title: chatSession.title,
    modelId: chatSession.modelId,
    updatedAt: chatSession.updatedAt,
    createdAt: chatSession.createdAt,
    messages: chatSession.messages,
  });
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.chatSession.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Chat not found" }, { status: 404 });
  }

  let body: { title?: unknown; modelId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const data: { title?: string; modelId?: string | null } = {};

  if (body.title !== undefined) {
    const t =
      typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
    if (t) data.title = t;
  }

  if (body.modelId !== undefined) {
    if (body.modelId === null || body.modelId === "") {
      data.modelId = null;
    } else if (typeof body.modelId === "string") {
      data.modelId = body.modelId.trim() || null;
    }
  }

  if (Object.keys(data).length === 0) {
    const row = await prisma.chatSession.findFirst({
      where: { id },
      select: {
        id: true,
        title: true,
        modelId: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json(row);
  }

  const row = await prisma.chatSession.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      modelId: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(request: NextRequest, context: RouteCtx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.chatSession.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Chat not found" }, { status: 404 });
  }

  await prisma.chatSession.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
