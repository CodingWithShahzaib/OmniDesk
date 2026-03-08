"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface SecretFormData {
  name: string;
  description?: string | null;
  value?: string;
}

interface SecretDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SecretFormData) => Promise<void>;
  initialData?: SecretFormData | null;
  isEdit?: boolean;
}

export function SecretDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isEdit,
}: SecretDialogProps) {
  const [form, setForm] = useState<SecretFormData>({
    name: "",
    description: "",
    value: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        name: initialData?.name || "",
        description: initialData?.description || "",
        value: "",
      });
      setError("");
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!isEdit && !form.value?.trim()) {
      setError("Value is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save secret");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Secret" : "Add Secret"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="secret-name">Name</Label>
            <Input
              id="secret-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. stripe_api_key"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret-description">Description (optional)</Label>
            <Input
              id="secret-description"
              value={form.description || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="What is this secret for?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret-value">
              Secret Value {isEdit ? "(leave blank to keep current)" : ""}
            </Label>
            <Textarea
              id="secret-value"
              value={form.value || ""}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="Paste the secret value"
              rows={4}
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
              {loading ? "Saving..." : isEdit ? "Update Secret" : "Add Secret"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
