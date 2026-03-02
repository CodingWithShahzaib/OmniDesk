import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createTask,
  getTasks,
} from "@/lib/timesheet";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;
  const start = searchParams.get("start") ?? undefined;
  const end = searchParams.get("end") ?? undefined;

  const tasks = await getTasks(session.user.id, month, start, end);
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { date, taskDetails, taskBullets, status, eodStatus, additionalRemarks } =
    body;

  if (!date || !taskDetails || !taskBullets || !status || !eodStatus) {
    return NextResponse.json(
      { message: "Missing required fields" },
      { status: 400 }
    );
  }

  const task = await createTask(session.user.id, {
    date,
    taskDetails,
    taskBullets,
    status,
    eodStatus,
    additionalRemarks,
  });
  return NextResponse.json(task);
}
