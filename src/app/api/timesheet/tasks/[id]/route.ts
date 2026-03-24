import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getTask,
  updateTask,
  deleteTask,
  buildValidatedTimesheetPatch,
} from "@/lib/timesheet";

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
    const task = await getTask(session.user.id, id);
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
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
  const body = await request.json();
  let existing;
  try {
    existing = await getTask(session.user.id, id);
  } catch {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }

  const built = buildValidatedTimesheetPatch(
    {
      status: existing.status,
      eodStatus: existing.eodStatus,
      additionalRemarks: existing.additionalRemarks,
    },
    body
  );
  if ("error" in built) {
    return NextResponse.json({ message: built.error }, { status: 400 });
  }

  try {
    const task = await updateTask(session.user.id, id, built.patch);
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
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
    await deleteTask(session.user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ message: "Task not found" }, { status: 404 });
  }
}
