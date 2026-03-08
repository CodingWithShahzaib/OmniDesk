"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecretDialog, type SecretFormData } from "@/components/SecretDialog";
import { Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";

type SecretSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type SecretWithValue = SecretSummary & { value: string };

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function SecretsPage() {
  const { data: session, isPending } = authClient.useSession();
  const [secrets, setSecrets] = useState<SecretSummary[]>([]);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealLoading, setRevealLoading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SecretSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSecrets = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/secrets", { credentials: "include" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as SecretSummary[];
      setSecrets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load secrets");
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) fetchSecrets();
  }, [session?.user]);

  const handleAdd = async (form: SecretFormData) => {
    const res = await fetch("/api/secrets", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        value: form.value,
      }),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const created = (await res.json()) as SecretSummary;
    setSecrets((prev) => [created, ...prev]);
  };

  const handleUpdate = async (form: SecretFormData) => {
    if (!editing) return;
    const payload: Record<string, unknown> = {
      name: form.name,
      description: form.description,
    };
    if (form.value && form.value.trim()) {
      payload.value = form.value;
    }

    const res = await fetch(`/api/secrets/${editing.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const updated = (await res.json()) as SecretSummary;
    setEditing(null);
    setSecrets((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this secret? This cannot be undone.")) return;
    const res = await fetch(`/api/secrets/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(await res.text());
    }
    setSecrets((prev) => prev.filter((s) => s.id !== id));
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleRevealToggle = async (id: string) => {
    // If already revealed, hide locally without another request
    if (revealed[id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setRevealLoading(id);
    try {
      const res = await fetch(`/api/secrets/${id}`, { credentials: "include" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const secret = (await res.json()) as SecretWithValue;
      setRevealed((prev) => ({ ...prev, [id]: secret.value }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reveal secret");
    } finally {
      setRevealLoading(null);
    }
  };

  const handleCopy = async (id: string) => {
    const value = revealed[id];
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      alert("Failed to copy");
    }
  };

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (secret: SecretSummary) => {
    setEditing(secret);
    setDialogOpen(true);
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
          Please sign in to view your secret vault.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Secret Vault</h1>
          <p className="text-muted-foreground">
            Store API keys and sensitive data securely
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Secret
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Secrets</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-destructive mb-3">Error: {error}</p>
          )}
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Loading...</p>
          ) : secrets.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No secrets yet. Click &quot;Add Secret&quot; to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret, idx) => {
                const isRevealed = Boolean(revealed[secret.id]);
                return (
                  <div
                    key={secret.id}
                    className={`rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm p-3 sm:p-4 transition hover:border-primary/50 ${
                      idx % 2 === 0
                        ? "shadow-[0_6px_24px_-18px_rgba(0,0,0,0.35)]"
                        : "shadow-[0_6px_24px_-18px_rgba(0,0,0,0.2)]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">{secret.name}</span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                                isRevealed
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
                                  : "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-100"
                              }`}
                            >
                              {isRevealed ? "Revealed" : "Hidden"}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {secret.description || "No description provided"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-md bg-muted/60 px-2 py-1">
                            Updated {formatDate(secret.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevealToggle(secret.id)}
                            disabled={revealLoading === secret.id}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {revealLoading === secret.id
                              ? "Reveal..."
                              : isRevealed
                              ? "Hide"
                              : "Reveal"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(secret.id)}
                            disabled={!isRevealed}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(secret)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDelete(secret.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/70 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-xs sm:text-sm font-mono leading-snug break-all max-h-24 overflow-auto">
                        {isRevealed ? revealed[secret.id] : "••••••••••"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SecretDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleAdd}
        initialData={
          editing
            ? {
                name: editing.name,
                description: editing.description || "",
                value: "",
              }
            : undefined
        }
        isEdit={!!editing}
      />
    </div>
  );
}
