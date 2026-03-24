import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  NOTE_CONTENT_JSON_MAX_BYTES,
  NOTE_TITLE_MAX,
  plainTextFromContentJson,
  previewFromPlainText,
} from "@/lib/note-content";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteCtx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const note = await prisma.note.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      title: true,
      contentJson: true,
      plainText: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  if (!note) {
    return NextResponse.json({ message: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...note,
    preview: previewFromPlainText(note.plainText),
  });
}

export async function PATCH(request: NextRequest, context: RouteCtx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.note.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Note not found" }, { status: 404 });
  }

  let body: { title?: unknown; contentJson?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const data: { title?: string; contentJson?: string; plainText?: string | null } =
    {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      return NextResponse.json({ message: "Invalid title" }, { status: 400 });
    }
    const t = body.title.trim().slice(0, NOTE_TITLE_MAX);
    data.title = t || "Untitled";
  }

  if (body.contentJson !== undefined) {
    if (typeof body.contentJson !== "string") {
      return NextResponse.json({ message: "Invalid contentJson" }, { status: 400 });
    }
    const bytes = Buffer.byteLength(body.contentJson, "utf8");
    if (bytes > NOTE_CONTENT_JSON_MAX_BYTES) {
      return NextResponse.json({ message: "Content too large" }, { status: 413 });
    }
    try {
      const parsed = JSON.parse(body.contentJson) as { type?: string };
      if (!parsed || parsed.type !== "doc") {
        return NextResponse.json({ message: "Invalid document" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ message: "Invalid JSON document" }, { status: 400 });
    }
    data.contentJson = body.contentJson;
    data.plainText = plainTextFromContentJson(body.contentJson) || null;
  }

  if (Object.keys(data).length === 0) {
    const row = await prisma.note.findFirst({
      where: { id },
      select: {
        id: true,
        title: true,
        contentJson: true,
        plainText: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      ...row,
      preview: previewFromPlainText(row?.plainText ?? null),
    });
  }

  const row = await prisma.note.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      contentJson: true,
      plainText: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ...row,
    preview: previewFromPlainText(row.plainText),
  });
}

export async function DELETE(request: NextRequest, context: RouteCtx) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.note.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ message: "Note not found" }, { status: 404 });
  }

  await prisma.note.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
