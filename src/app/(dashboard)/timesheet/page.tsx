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
import { Calendar, Plus, Download, Pencil, Trash2 } from "lucide-react";

interface TimesheetTask {
  id: string;
  date: string;
  taskDetails: string;
  taskBullets: string;
  status: string;
  eodStatus: string;
  additionalRemarks: string | null;
}

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

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
  const [month, setMonth] = useState(currentMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TimesheetTask | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/timesheet/tasks?month=${month}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Failed to load tasks (${res.status})`);
      }
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) fetchTasks();
  }, [session?.user, month]);

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
      setTasks((prev) => [created, ...prev]);
    } else {
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
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/timesheet/export?month=${month}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OmniDesk_Timesheet_${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
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
    <div className="space-y-6">
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
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm outline-none"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            className="border-white/60 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            onClick={() => {
              setEditingTask(null);
              setDialogOpen(true);
            }}
            className="shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      <Card className="border border-white/60 dark:border-white/10 bg-card/80 backdrop-blur-2xl shadow-[0_24px_90px_-48px_rgba(0,0,0,0.6)]">
        <CardHeader>
          <CardTitle>Tasks for {month}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No tasks yet. Click &quot;Add Task&quot; to get started.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="sticky top-0 bg-card/90 backdrop-blur border-b border-white/60 dark:border-white/10">
                    <TableRow>
                      <TableHead className="w-32">Date</TableHead>
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
                        <TableCell>
                          {new Date(task.date).toLocaleDateString()}
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
                              className="rounded-full hover:bg-primary/10"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTask(task.id)}
                              aria-label="Delete"
                              className="rounded-full hover:bg-rose-100/70 dark:hover:bg-rose-900/30"
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
                          {new Date(task.date).toLocaleDateString()}
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
                        className="border-white/60 dark:border-white/10"
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
            </>
          )}
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
      />
    </div>
  );
}
