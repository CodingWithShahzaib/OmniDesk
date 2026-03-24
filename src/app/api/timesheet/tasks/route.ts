import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createTask,
  getTasks,
  getTasksPage,
  validateCreateTimesheetTask,
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

  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const paginate = pageParam !== null || pageSizeParam !== null;

  if (paginate) {
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
    const pageSize = Math.max(1, parseInt(pageSizeParam ?? "20", 10) || 20);
    const result = await getTasksPage(session.user.id, {
      month,
      start,
      end,
      page,
      pageSize,
    });
    return NextResponse.json(result);
  }

  const tasks = await getTasks(session.user.id, month, start, end);
  return NextResponse.json(tasks);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = validateCreateTimesheetTask(body);
  if ("error" in parsed) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const task = await createTask(session.user.id, parsed.data);

  return NextResponse.json(task);
}
