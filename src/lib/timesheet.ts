import { prisma } from "./db";
import * as ExcelJS from "exceljs";

export const TIMESHEET_STATUSES = [
  "In-Progress",
  "Completed",
  "On-Hold",
  "Cancelled",
] as const;

export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

function isTimesheetStatus(value: unknown): value is TimesheetStatus {
  return (
    typeof value === "string" &&
    (TIMESHEET_STATUSES as readonly string[]).includes(value)
  );
}

/** UTC calendar bounds for `YYYY-MM`, matching list/export queries. */
export function monthRangeUtc(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, (m || 1) - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, m || 1, 0, 23, 59, 59, 999));
  return { start, end };
}

function toUTCDateOnly(dateString: string): Date {
  // Expecting yyyy-mm-dd; construct a UTC date at midnight to avoid TZ shifts
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

export interface CreateTaskInput {
  date: string;
  taskDetails: string;
  taskBullets: string;
  status: TimesheetStatus;
  eodStatus: TimesheetStatus;
  additionalRemarks?: string;
}

export interface UpdateTaskInput
  extends Partial<Omit<CreateTaskInput, "additionalRemarks">> {
  additionalRemarks?: string | null;
}

function statusNeedsRemarks(status: string): boolean {
  return status === "On-Hold" || status === "Cancelled";
}

export function validateCreateTimesheetTask(
  body: unknown
): { error: string } | { data: CreateTaskInput } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const { date, taskDetails, taskBullets, status, eodStatus, additionalRemarks } =
    b;

  if (
    typeof date !== "string" ||
    typeof taskDetails !== "string" ||
    typeof taskBullets !== "string"
  ) {
    return { error: "Missing required fields" };
  }
  if (!isTimesheetStatus(status) || !isTimesheetStatus(eodStatus)) {
    return { error: "Invalid status or eodStatus" };
  }
  if (statusNeedsRemarks(status) && !(String(additionalRemarks ?? "").trim())) {
    return {
      error:
        "Additional remarks are required for On-Hold or Cancelled status",
    };
  }

  return {
    data: {
      date,
      taskDetails,
      taskBullets,
      status,
      eodStatus,
      additionalRemarks:
        typeof additionalRemarks === "string" ? additionalRemarks : undefined,
    },
  };
}

const PATCH_KEYS = [
  "date",
  "taskDetails",
  "taskBullets",
  "status",
  "eodStatus",
  "additionalRemarks",
] as const;

export function buildValidatedTimesheetPatch(
  existing: {
    status: string;
    eodStatus: string;
    additionalRemarks: string | null;
  },
  body: unknown
): { error: string } | { patch: UpdateTaskInput } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const patch: UpdateTaskInput = {};
  for (const key of PATCH_KEYS) {
    if (key in b && b[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = b[key];
    }
  }
  if (Object.keys(patch).length === 0) {
    return { error: "No valid fields to update" };
  }

  if (patch.date !== undefined && typeof patch.date !== "string") {
    return { error: "Invalid date" };
  }
  if (patch.taskDetails !== undefined && typeof patch.taskDetails !== "string") {
    return { error: "Invalid taskDetails" };
  }
  if (patch.taskBullets !== undefined && typeof patch.taskBullets !== "string") {
    return { error: "Invalid taskBullets" };
  }
  if (
    patch.additionalRemarks !== undefined &&
    patch.additionalRemarks !== null &&
    typeof patch.additionalRemarks !== "string"
  ) {
    return { error: "Invalid additionalRemarks" };
  }

  if (patch.status !== undefined && !isTimesheetStatus(patch.status)) {
    return { error: "Invalid status" };
  }
  if (patch.eodStatus !== undefined && !isTimesheetStatus(patch.eodStatus)) {
    return { error: "Invalid eodStatus" };
  }

  const mergedStatus = patch.status ?? existing.status;
  const mergedRemarks =
    patch.additionalRemarks !== undefined
      ? patch.additionalRemarks
      : existing.additionalRemarks;

  if (
    statusNeedsRemarks(mergedStatus) &&
    !(mergedRemarks ?? "").trim()
  ) {
    return {
      error:
        "Additional remarks are required for On-Hold or Cancelled status",
    };
  }

  return { patch };
}

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

function buildTimesheetTaskWhere(
  userId: string,
  month?: string,
  rangeStart?: string,
  rangeEnd?: string
): { userId: string; date?: { gte: Date; lte: Date } } {
  const where: { userId: string; date?: { gte: Date; lte: Date } } = {
    userId,
  };

  if (month) {
    const { start, end } = monthRangeUtc(month);
    where.date = { gte: start, lte: end };
  } else if (rangeStart && rangeEnd) {
    const startDate = toUTCDateOnly(rangeStart);
    const endDate = toUTCDateOnly(rangeEnd);
    endDate.setUTCHours(23, 59, 59, 999);
    where.date = { gte: startDate, lte: endDate };
  }

  return where;
}

export async function getTasks(
  userId: string,
  month?: string,
  start?: string,
  end?: string
) {
  const where = buildTimesheetTaskWhere(userId, month, start, end);

  return prisma.timesheetTask.findMany({
    where,
    orderBy: { date: "desc" },
    include: { user: { select: { name: true } } },
  });
}

export interface TimesheetTasksPage {
  items: Awaited<ReturnType<typeof getTasks>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const MAX_PAGE_SIZE = 100;

export async function getTasksPage(
  userId: string,
  options: {
    month?: string;
    start?: string;
    end?: string;
    page: number;
    pageSize: number;
  }
): Promise<TimesheetTasksPage> {
  const where = buildTimesheetTaskWhere(
    userId,
    options.month,
    options.start,
    options.end
  );

  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(options.pageSize)) || 1)
  );
  const total = await prisma.timesheetTask.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rawPage = Math.max(1, Math.floor(Number(options.page)) || 1);
  const page = Math.min(rawPage, totalPages);
  const skip = (page - 1) * pageSize;

  const items = await prisma.timesheetTask.findMany({
    where,
    orderBy: { date: "desc" },
    skip,
    take: pageSize,
    include: { user: { select: { name: true } } },
  });

  return { items, total, page, pageSize, totalPages };
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

/** Calendar date as YYYY-MM-DD in UTC (stable in Excel across time zones). */
export function calendarDateIsoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatExportBullets(taskBullets: string): string {
  const bullets = taskBullets
    .split("\n")
    .map((b) => (b.trim().startsWith("•") ? b.trim().slice(1).trim() : b.trim()))
    .filter(Boolean);
  return bullets.map((b) => `• ${b}`).join("\r\n");
}

async function loadTimesheetMonthExport(userId: string, month: string) {
  const { start: startDate, end: endDate } = monthRangeUtc(month);
  const tasks = await prisma.timesheetTask.findMany({
    where: { userId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
  });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }
  const fullName = user.name || user.email;
  return { tasks, fullName };
}

const EXPORT_CSV_HEADERS = [
  "Date",
  "Resource Name",
  "Task Details",
  "Task Details (4-5 bullet points minimum for daily work)",
  "Status (In-Progress, Completed, On-Hold, Cancelled)",
  "EOD Status (To be updated by EOD)",
  "Additional Remarks (mandatory for On-Hold and Cancelled status)",
] as const;

function csvEscapeField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export async function exportMonthCsv(
  userId: string,
  month: string
): Promise<Buffer> {
  const { tasks, fullName } = await loadTimesheetMonthExport(userId, month);
  const lines: string[] = [
    EXPORT_CSV_HEADERS.map((h) => csvEscapeField(h)).join(","),
  ];
  for (const task of tasks) {
    const row = [
      calendarDateIsoUtc(task.date),
      fullName,
      task.taskDetails || "",
      formatExportBullets(task.taskBullets).replace(/\r\n/g, "\n"),
      task.status,
      task.eodStatus,
      task.additionalRemarks || "",
    ];
    lines.push(row.map((cell) => csvEscapeField(cell)).join(","));
  }
  return Buffer.from(lines.join("\n"), "utf8");
}

export async function exportMonth(userId: string, month: string): Promise<Buffer> {
  const { tasks, fullName } = await loadTimesheetMonthExport(userId, month);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily Status", {
    headerFooter: { firstHeader: "OmniDesk Timesheet Export" },
    views: [
      {
        state: "frozen",
        xSplit: 0,
        ySplit: 1,
        topLeftCell: "A2",
        activeCell: "A2",
      },
    ],
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
  sheet.autoFilter = "A1:G1";

  sheet.getColumn(1).alignment = { vertical: "top" };
  sheet.getColumn(3).alignment = { vertical: "top" };
  sheet.getColumn(4).alignment = { wrapText: true, vertical: "top" };

  let rowNum = 2;
  for (const task of tasks) {
    // Add row values directly; avoid formulas to ensure consistent export
    sheet.addRow({
      date: calendarDateIsoUtc(task.date),
      resourceName: fullName,
      taskDetails: task.taskDetails || "",
      taskBullets: formatExportBullets(task.taskBullets),
      status: task.status,
      eodStatus: task.eodStatus,
      additionalRemarks: task.additionalRemarks || "",
    });

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
