"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = ["In-Progress", "Completed", "On-Hold", "Cancelled"] as const;

export interface TaskFormData {
  date: string;
  taskDetails: string;
  taskBullets: string;
  status: (typeof STATUSES)[number];
  eodStatus: (typeof STATUSES)[number];
  additionalRemarks?: string;
}

const emptyForm: TaskFormData = {
  date: new Date().toISOString().slice(0, 10),
  taskDetails: "",
  taskBullets: "",
  status: "In-Progress",
  eodStatus: "In-Progress",
  additionalRemarks: "",
};

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  initialData?: TaskFormData | null;
  isEdit?: boolean;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isEdit,
}: AddTaskDialogProps) {
  const [form, setForm] = useState<TaskFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTaskBulletsKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const BULLET = "• ";
    const target = e.currentTarget;
    const { selectionStart, selectionEnd, value } = target;

    // If empty, start the first bullet instead of inserting a newline
    if (!value) {
      const next = BULLET;
      setForm((f) => ({ ...f, taskBullets: next }));
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = next.length;
      });
      return;
    }

    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const insert = "\n" + BULLET;
    const next = before + insert + after;
    const caretPos = before.length + insert.length;

    setForm((f) => ({ ...f, taskBullets: next }));
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = caretPos;
    });
  };

  useEffect(() => {
    if (open) {
      setForm(
        initialData
          ? {
              ...initialData,
              date:
                typeof initialData.date === "string"
                  ? initialData.date.slice(0, 10)
                  : new Date(initialData.date).toISOString().slice(0, 10),
            }
          : { ...emptyForm, date: new Date().toISOString().slice(0, 10) }
      );
      setError("");
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (form.status === "On-Hold" || form.status === "Cancelled") &&
      !form.additionalRemarks?.trim()
    ) {
      setError(
        "Additional remarks are required for On-Hold or Cancelled status"
      );
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card/85 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_24px_80px_-38px_rgba(0,0,0,0.65)]">
        <DialogHeader className="space-y-2">
          <DialogTitle>{isEdit ? "Edit Task" : "Add Task"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Capture what you shipped today — details help your export stay crisp.
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskDetails">Task Details (Project)</Label>
              <Input
                id="taskDetails"
                placeholder="e.g. AD-PORTS"
                value={form.taskDetails}
                onChange={(e) =>
                  setForm((f) => ({ ...f, taskDetails: e.target.value }))
                }
                required
                className="bg-white/80 dark:bg-white/5 backdrop-blur"
              />
              <p className="text-xs text-muted-foreground">
                Keep it short — feature, ticket, or project name.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskBullets">
              Task Details (4-5 bullet points for daily work)
            </Label>
            <Textarea
              id="taskBullets"
              placeholder={
                "• Working on feature X\n• Fixed bug in module Y\n• Code review for PR #123"
              }
              rows={5}
              value={form.taskBullets}
              onChange={(e) =>
                setForm((f) => ({ ...f, taskBullets: e.target.value }))
              }
              onKeyDown={handleTaskBulletsKeyDown}
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Press Enter to start a new bullet. Be specific about outcomes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as (typeof STATUSES)[number] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>EOD Status</Label>
              <Select
                value={form.eodStatus}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    eodStatus: v as (typeof STATUSES)[number],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">
              Additional Remarks (required for On-Hold/Cancelled)
            </Label>
            <Textarea
              id="remarks"
              placeholder="e.g. On-Hold (API issues being resolved by backend team)"
              rows={2}
              value={form.additionalRemarks || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, additionalRemarks: e.target.value }))
              }
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
