import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  emptyNoteContentJson,
  NOTE_TITLE_MAX,
  plainTextFromContentJson,
  previewFromPlainText,
} from "@/lib/note-content";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const where =
    q.length > 0
      ? {
          userId: session.user.id,
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { plainText: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : { userId: session.user.id };

  const rows = await prisma.note.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      plainText: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const list = rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
    preview: previewFromPlainText(r.plainText),
  }));

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { title?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const titleRaw =
    typeof body.title === "string"
      ? body.title.trim().slice(0, NOTE_TITLE_MAX)
      : "";
  const contentJson = emptyNoteContentJson();
  const plainText = plainTextFromContentJson(contentJson);

  const created = await prisma.note.create({
    data: {
      userId: session.user.id,
      title: titleRaw || "Untitled",
      contentJson,
      plainText,
    },
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
    id: created.id,
    title: created.title,
    contentJson: created.contentJson,
    plainText: created.plainText,
    updatedAt: created.updatedAt,
    createdAt: created.createdAt,
    preview: previewFromPlainText(created.plainText),
  });
}
