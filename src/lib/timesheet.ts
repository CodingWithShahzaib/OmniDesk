import { prisma } from "./db";
import * as ExcelJS from "exceljs";

const STATUSES = ["In-Progress", "Completed", "On-Hold", "Cancelled"] as const;

function toUTCDateOnly(dateString: string): Date {
  // Expecting yyyy-mm-dd; construct a UTC date at midnight to avoid TZ shifts
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

export interface CreateTaskInput {
  date: string;
  taskDetails: string;
  taskBullets: string;
  status: (typeof STATUSES)[number];
  eodStatus: (typeof STATUSES)[number];
  additionalRemarks?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {}

export async function createTask(userId: string, input: CreateTaskInput) {
  const date = toUTCDateOnly(input.date);

  return prisma.timesheetTask.create({
    data: {
      userId,
      date,
      taskDetails: input.taskDetails,
      taskBullets: input.taskBullets,
      status: input.status,
      eodStatus: input.eodStatus,
      additionalRemarks: input.additionalRemarks,
    },
    include: { user: { select: { name: true, email: true } } },
  });
}

export async function getTasks(
  userId: string,
  month?: string,
  start?: string,
  end?: string
) {
  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = {
    userId,
  };

  if (month) {
    const [year, m] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, (m || 1) - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, m || 1, 0, 23, 59, 59, 999));
    where.date = { gte: startDate, lte: endDate };
  } else if (start && end) {
    const startDate = toUTCDateOnly(start);
    const endDate = toUTCDateOnly(end);
    endDate.setUTCHours(23, 59, 59, 999);
    where.date = { gte: startDate, lte: endDate };
  }

  return prisma.timesheetTask.findMany({
    where,
    orderBy: { date: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export async function getTask(userId: string, id: string) {
  const task = await prisma.timesheetTask.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!task || task.userId !== userId) {
    throw new Error("Task not found");
  }
  return task;
}

export async function updateTask(userId: string, id: string, input: UpdateTaskInput) {
  await getTask(userId, id);

  const data: Record<string, unknown> = { ...input };
  if (input.date) {
    data.date = toUTCDateOnly(input.date);
  }

  return prisma.timesheetTask.update({
    where: { id },
    data,
    include: { user: { select: { name: true } } },
  });
}

export async function deleteTask(userId: string, id: string) {
  await getTask(userId, id);
  return prisma.timesheetTask.delete({ where: { id } });
}

export async function exportMonth(userId: string, month: string): Promise<Buffer> {
  const [year, m] = month.split("-").map(Number);
  const startDate = new Date(year, m - 1, 1);
  const endDate = new Date(year, m, 0, 23, 59, 59, 999);

  const tasks = await prisma.timesheetTask.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
    include: { user: true },
  });

  const user =
    tasks[0]?.user ?? (await prisma.user.findUnique({ where: { id: userId } }));
  if (!user) {
    throw new Error("User not found");
  }

  const fullName = user.name || user.email;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily Status", {
    headerFooter: { firstHeader: "OmniDesk Timesheet Export" },
  });

  sheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Resource Name", key: "resourceName", width: 20 },
    { header: "Task Details", key: "taskDetails", width: 20 },
    {
      header: "Task Details (4-5 bullet points minimum for daily work)",
      key: "taskBullets",
      width: 50,
    },
    {
      header: "Status (In-Progress, Completed, On-Hold, Cancelled)",
      key: "status",
      width: 15,
    },
    {
      header: "EOD Status (To be updated by EOD)",
      key: "eodStatus",
      width: 15,
    },
    {
      header:
        "Additional Remarks (mandatory for On-Hold and Cancelled status)",
      key: "additionalRemarks",
      width: 40,
    },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  // Ensure multi-line bullets and top alignment by default
  sheet.getColumn(3).alignment = { vertical: "top" };
  sheet.getColumn(4).alignment = { wrapText: true, vertical: "top" };

  let rowNum = 2;
  for (const task of tasks) {
    const bullets = task.taskBullets
      .split("\n")
      .map((b) => (b.trim().startsWith("•") ? b.trim().slice(1).trim() : b.trim()))
      .filter(Boolean);

    // Add row values directly; avoid formulas to ensure consistent export
    sheet.addRow({
      date: task.date,
      resourceName: fullName,
      taskDetails: task.taskDetails || "",
      taskBullets: bullets.map((b) => `• ${b}`).join("\r\n"),
      status: task.status,
      eodStatus: task.eodStatus,
      additionalRemarks: task.additionalRemarks || "",
    });

    // Enable wrapping for bullets column so newlines show in Excel
    const row = sheet.getRow(rowNum);
    const bulletsCell = row.getCell(4);
    bulletsCell.alignment = { wrapText: true, vertical: "top" };
    const detailsCell = row.getCell(3);
    detailsCell.alignment = { vertical: "top" };
    rowNum++;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
