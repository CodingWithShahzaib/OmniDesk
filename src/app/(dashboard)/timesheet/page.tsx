"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddTaskDialog, type TaskFormData } from "@/components/AddTaskDialog";
import {
  Calendar,
  Plus,
  Download,
  FileText,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { AppLoaderPanel, AppPageLoader } from "@/components/ui/app-loader";
import { parseFilenameFromContentDisposition } from "@/lib/content-disposition";

interface TimesheetTask {
  id: string;
  date: string;
  taskDetails: string;
  taskBullets: string;
  status: string;
  eodStatus: string;
  additionalRemarks: string | null;
}

const PAGE_SIZE = 4;
/** Recent tasks in month for AI context (API page 1). */
const AI_CONTEXT_SIZE = 12;

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function formatTaskDateDisplay(isoDate: string) {
  const [y, m, d] = isoDate.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TimesheetPage() {
  const renderStatus = (value: string) => {
    const base =
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 shadow-sm";
    switch (value) {
      case "Completed":
        return (
          <span
            className={`${base} bg-emerald-100/80 text-emerald-900 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-800/60`}
          >
            Completed
          </span>
        );
      case "On-Hold":
        return (
          <span
            className={`${base} bg-amber-100/80 text-amber-900 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800/60`}
          >
            On-Hold
          </span>
        );
      case "Cancelled":
        return (
          <span
            className={`${base} bg-rose-100/80 text-rose-900 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:ring-rose-800/60`}
          >
            Cancelled
          </span>
        );
      default:
        return (
          <span
            className={`${base} bg-blue-100/80 text-blue-900 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:ring-blue-800/60`}
          >
            In-Progress
          </span>
        );
    }
  };

  const renderBullets = (text: string) => {
    const items = text
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    return (
      <ul className="list-disc ml-5 space-y-1">
        {items.map((b, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            {b.startsWith("•") ? b.slice(1).trim() : b}
          </li>
        ))}
      </ul>
    );
  };

  const { data: session, isPending } = authClient.useSession();
  const [tasks, setTasks] = useState<TimesheetTask[]>([]);
  const [total, setTotal] = useState(0);
  const [tasksForAi, setTasksForAi] = useState<TimesheetTask[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TimesheetTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataMonth, setDataMonth] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const displayStart =
    total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const displayEnd = Math.min(safePage * PAGE_SIZE, total);

  useEffect(() => {
    setExportError(null);
    setExportSuccess(null);
  }, [month]);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    const loadAiContext = async () => {
      try {
        const res = await fetch(
          `/api/timesheet/tasks?month=${encodeURIComponent(month)}&page=1&pageSize=${AI_CONTEXT_SIZE}`,
          { credentials: "include" }
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          items?: TimesheetTask[];
        };
        if (Array.isArray(body.items) && !cancelled) {
          setTasksForAi(body.items);
        }
      } catch {
        /* non-fatal for AI hints */
      }
    };

    void loadAiContext();
    return () => {
      cancelled = true;
    };
  }, [session?.user, month]);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/timesheet/tasks?month=${encodeURIComponent(month)}&page=${page}&pageSize=${PAGE_SIZE}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          let msg = await res.text();
          try {
            const j = JSON.parse(msg) as { message?: string };
            if (j?.message) msg = j.message;
          } catch {
            /* use raw text */
          }
          throw new Error(msg || `Failed to load tasks (${res.status})`);
        }
        const body = (await res.json()) as {
          items?: TimesheetTask[];
          total?: number;
          page?: number;
        };
        if (cancelled) return;
        if (!Array.isArray(body.items) || typeof body.total !== "number") {
          throw new Error("Invalid response from server");
        }
        setTasks(body.items);
        setTotal(body.total);
        if (typeof body.page === "number" && body.page !== page) {
          setPage(body.page);
        }
        setDataMonth(month);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error ? e.message : "Failed to load tasks"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [session?.user, month, page]);

  const refetchTasks = () => {
    if (!session?.user) return;
    setLoadError(null);
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/timesheet/tasks?month=${encodeURIComponent(month)}&page=${page}&pageSize=${PAGE_SIZE}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          let msg = await res.text();
          try {
            const j = JSON.parse(msg) as { message?: string };
            if (j?.message) msg = j.message;
          } catch {
            /* use raw text */
          }
          throw new Error(msg || `Failed to load tasks (${res.status})`);
        }
        const body = (await res.json()) as {
          items?: TimesheetTask[];
          total?: number;
          page?: number;
        };
        if (!Array.isArray(body.items) || typeof body.total !== "number") {
          throw new Error("Invalid response from server");
        }
        setTasks(body.items);
        setTotal(body.total);
        if (typeof body.page === "number" && body.page !== page) {
          setPage(body.page);
        }
        setDataMonth(month);
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "Failed to load tasks"
        );
      } finally {
        setLoading(false);
      }
    })();
  };

  const refreshAiContext = () => {
    void (async () => {
      try {
        const res = await fetch(
          `/api/timesheet/tasks?month=${encodeURIComponent(month)}&page=1&pageSize=${AI_CONTEXT_SIZE}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const body = (await res.json()) as { items?: TimesheetTask[] };
        if (Array.isArray(body.items)) setTasksForAi(body.items);
      } catch {
        /* ignore */
      }
    })();
  };

  const handleAddTask = async (form: TaskFormData) => {
    const res = await fetch("/api/timesheet/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || `Failed to add task (${res.status})`);
    }
    const created = (await res.json()) as TimesheetTask;
    // If created task is in the current visible month, show it immediately.
    // Otherwise, switch the month view to the created task's month.
    const d = new Date(created.date);
    const createdMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (createdMonth === month) {
      setPage(1);
      const listRes = await fetch(
        `/api/timesheet/tasks?month=${encodeURIComponent(month)}&page=1&pageSize=${PAGE_SIZE}`,
        { credentials: "include" }
      );
      if (listRes.ok) {
        const body = (await listRes.json()) as {
          items?: TimesheetTask[];
          total?: number;
          page?: number;
        };
        if (Array.isArray(body.items) && typeof body.total === "number") {
          setTasks(body.items);
          setTotal(body.total);
          if (typeof body.page === "number") setPage(body.page);
        }
      }
      refreshAiContext();
    } else {
      setPage(1);
      setMonth(createdMonth);
    }
  };

  const handleUpdateTask = async (form: TaskFormData) => {
    if (!editingTask) return;
    const res = await fetch(`/api/timesheet/tasks/${editingTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || `Failed to update task (${res.status})`);
    }
    const updated = (await res.json()) as TimesheetTask;
    setEditingTask(null);
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    refreshAiContext();
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/timesheet/tasks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok && res.status !== 204) {
      const msg = await res.text();
      throw new Error(msg || `Failed to delete task (${res.status})`);
    }
    if (tasks.length === 1 && page > 1) {
      setPage((p) => p - 1);
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    }
    refreshAiContext();
  };

  const handleExport = async (format: "xlsx" | "csv") => {
    setExportLoading(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const qs =
        format === "csv"
          ? `month=${encodeURIComponent(month)}&format=csv`
          : `month=${encodeURIComponent(month)}`;
      const res = await fetch(`/api/timesheet/export?${qs}`, {
        credentials: "include",
      });
      if (!res.ok) {
        let msg = await res.text();
        try {
          const j = JSON.parse(msg) as { message?: string };
          if (j?.message) msg = j.message;
        } catch {
          /* use raw text */
        }
        throw new Error(msg || `Export failed (${res.status})`);
      }
      const cd = res.headers.get("Content-Disposition");
      const fallback =
        format === "csv"
          ? `OmniDesk_Timesheet_${month}.csv`
          : `OmniDesk_Timesheet_${month}.xlsx`;
      const filename = parseFilenameFromContentDisposition(cd, fallback);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (total === 0) {
        setExportSuccess("Exported template — no tasks for this month.");
      }
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Export failed"
      );
    } finally {
      setExportLoading(false);
    }
  };

  const openEdit = (task: TimesheetTask) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  if (isPending) {
    return <AppPageLoader />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">
          Please sign in to view your timesheet.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-center rounded-2xl border border-white/60 dark:border-white/10 bg-card/70 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_20px_70px_-40px_rgba(0,0,0,0.55)]">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Timesheet Manager</h1>
          <p className="text-muted-foreground">
            Add daily tasks, track progress, and export monthly reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2 backdrop-blur">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setPage(1);
                setMonth(e.target.value);
              }}
              className="bg-transparent text-sm outline-none"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => handleExport("xlsx")}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export XLSX
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("csv")}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditingTask(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
        {exportError ? (
          <p
            role="alert"
            className="text-sm text-destructive col-span-full"
          >
            {exportError}
          </p>
        ) : null}
        {exportSuccess ? (
          <p
            role="status"
            className="text-sm text-muted-foreground col-span-full"
          >
            {exportSuccess}
          </p>
        ) : null}
      </div>

      <Card className="border border-white/60 dark:border-white/10 bg-card/80 backdrop-blur-2xl shadow-[0_24px_90px_-48px_rgba(0,0,0,0.6)]">
        <CardHeader>
          <CardTitle>Tasks for {month}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium">Could not load timesheet</p>
                <p className="text-destructive/90 break-words">{loadError}</p>
                {dataMonth && dataMonth !== month && tasks.length > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    The list below is still for {dataMonth}.
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-destructive/40"
                onClick={() => refetchTasks()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Retry"
                )}
              </Button>
            </div>
          ) : null}
          {loading ? (
            <AppLoaderPanel label="Loading tasks…" className="py-8" />
          ) : tasks.length === 0 && !loadError ? (
            <p className="text-muted-foreground py-8 text-center">
              No tasks yet. Click &quot;Add Task&quot; to get started.
            </p>
          ) : tasks.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card/90 backdrop-blur border-b border-white/60 dark:border-white/10">
                    <TableRow>
                      <TableHead className="min-w-[200px]">Date</TableHead>
                      <TableHead>Task Details</TableHead>
                      <TableHead className="w-36">Status</TableHead>
                      <TableHead className="w-36">EOD</TableHead>
                      <TableHead className="w-[110px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow
                        key={task.id}
                        className="hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
                      >
                        <TableCell className="whitespace-nowrap">
                          {formatTaskDateDisplay(
                            typeof task.date === "string"
                              ? task.date
                              : new Date(task.date).toISOString().slice(0, 10)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <span className="font-medium leading-tight">{task.taskDetails}</span>
                            {renderBullets(task.taskBullets)}
                            {task.additionalRemarks ? (
                              <p className="text-xs text-muted-foreground">
                                Remarks: {task.additionalRemarks}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{renderStatus(task.status)}</TableCell>
                        <TableCell>{renderStatus(task.eodStatus)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(task)}
                              aria-label="Edit"
                              className="hover:bg-primary/10"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTask(task.id)}
                              aria-label="Delete"
                              className="hover:bg-rose-100/70 dark:hover:bg-rose-900/30"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-white/60 dark:border-white/10 bg-card/80 backdrop-blur p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {formatTaskDateDisplay(
                            typeof task.date === "string"
                              ? task.date
                              : new Date(task.date).toISOString().slice(0, 10)
                          )}
                        </div>
                        <div className="font-medium leading-tight">{task.taskDetails}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {renderStatus(task.status)}
                        {renderStatus(task.eodStatus)}
                      </div>
                    </div>
                    <div className="mt-2">{renderBullets(task.taskBullets)}</div>
                    {task.additionalRemarks ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Remarks: {task.additionalRemarks}
                      </div>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(task)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {total > PAGE_SIZE ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-white/60 dark:border-white/10 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {displayStart}–{displayEnd} of {total} tasks
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm tabular-nums text-muted-foreground px-1">
                      Page {safePage} of {totalPages}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <AddTaskDialog
        open={dialogOpen}
        onOpenChange={closeDialog}
        onSubmit={editingTask ? handleUpdateTask : handleAddTask}
        initialData={
          editingTask
            ? {
                date: editingTask.date,
                taskDetails: editingTask.taskDetails,
                taskBullets: editingTask.taskBullets,
                status: editingTask.status as TaskFormData["status"],
                eodStatus: editingTask.eodStatus as TaskFormData["eodStatus"],
                additionalRemarks: editingTask.additionalRemarks ?? undefined,
              }
            : (() => {
                const [yStr, mStr] = month.split("-");
                const y = Number(yStr);
                const m = Number(mStr);
                const today = new Date();
                const isSameMonth =
                  today.getFullYear() === y && today.getMonth() + 1 === m;
                const dateISO = isSameMonth
                  ? today.toISOString().slice(0, 10)
                  : new Date(y, m - 1, 1).toISOString().slice(0, 10);
                return {
                  date: dateISO,
                  taskDetails: "",
                  taskBullets: "",
                  status: "In-Progress" as TaskFormData["status"],
                  eodStatus: "In-Progress" as TaskFormData["eodStatus"],
                  additionalRemarks: "",
                };
              })()
        }
        isEdit={!!editingTask}
        previousTasksForAi={tasksForAi
          .filter((t) => !editingTask || t.id !== editingTask.id)
          .map((t) => ({
            date:
              typeof t.date === "string"
                ? t.date.slice(0, 10)
                : new Date(t.date).toISOString().slice(0, 10),
            taskDetails: t.taskDetails,
            taskBullets: t.taskBullets,
          }))}
      />
    </div>
  );
}
