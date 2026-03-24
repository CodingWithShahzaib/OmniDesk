"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings } from "lucide-react";
import { AppLoaderIcon, AppLoaderPanel, AppPageLoader } from "@/components/ui/app-loader";

type SecretSummary = {
  id: string;
  name: string;
  description: string | null;
};

type FreeModel = { id: string; name: string };

const OPENROUTER_FREE_AUTO: FreeModel = {
  id: "openrouter/free",
  name: "OpenRouter — auto free routing",
};

export default function SettingsPage() {
  const { data: session, isPending } = authClient.useSession();
  const [secrets, setSecrets] = useState<SecretSummary[]>([]);
  const [secretId, setSecretId] = useState<string>("");
  const [modelId, setModelId] = useState<string>("");
  const [freeModels, setFreeModels] = useState<FreeModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const modelOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: FreeModel[] = [];
    for (const m of [OPENROUTER_FREE_AUTO, ...freeModels]) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push(m);
      }
    }
    if (modelId && !seen.has(modelId)) {
      list.push({ id: modelId, name: `${modelId} (saved)` });
    }
    return list;
  }, [freeModels, modelId]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [secRes, setRes] = await Promise.all([
          fetch("/api/secrets", { credentials: "include" }),
          fetch("/api/settings", { credentials: "include" }),
        ]);
        if (!secRes.ok) throw new Error(await secRes.text());
        if (!setRes.ok) throw new Error(await setRes.text());
        const secData = (await secRes.json()) as SecretSummary[];
        const cfg = (await setRes.json()) as {
          openRouterModelId: string | null;
          openRouterSecretId: string | null;
        };
        if (cancelled) return;
        setSecrets(Array.isArray(secData) ? secData : []);
        setSecretId(cfg.openRouterSecretId ?? "");
        setModelId(cfg.openRouterModelId ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user || !secretId) {
      setFreeModels([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/openrouter/free-models?secretId=${encodeURIComponent(secretId)}`,
          { credentials: "include" }
        );
        const data = (await res.json()) as { message?: string; models?: FreeModel[] };
        if (!res.ok) throw new Error(data.message || `Failed to load models (${res.status})`);
        if (cancelled) return;
        setFreeModels(Array.isArray(data.models) ? data.models : []);
      } catch (e) {
        if (!cancelled) {
          setFreeModels([]);
          setError(e instanceof Error ? e.message : "Failed to load free models");
        }
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, secretId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSavedAt(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openRouterSecretId: secretId || null,
          openRouterModelId: modelId || null,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message || `Save failed (${res.status})`);
      setSavedAt(new Date().toLocaleString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (isPending) {
    return <AppPageLoader label="Loading session" />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please sign in to view settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-card/70 backdrop-blur-2xl p-4 sm:p-5 shadow-[0_20px_70px_-40px_rgba(0,0,0,0.55)]">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/50 dark:border-white/10 bg-white/70 dark:bg-white/5 p-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground text-sm">
              Choose which vault secret holds your OpenRouter API key and which free model to use for
              timesheet AI descriptions.
            </p>
          </div>
        </div>
      </div>

      <Card className="border border-white/60 dark:border-white/10 bg-card/80 backdrop-blur-2xl shadow-[0_24px_90px_-48px_rgba(0,0,0,0.6)]">
        <CardHeader>
          <CardTitle>OpenRouter (AI)</CardTitle>
          <CardDescription>
            Keys stay in{" "}
            <Link href="/secrets" className="text-primary underline-offset-4 hover:underline">
              Secret Vault
            </Link>
            . The model list is filtered to free models (zero prompt/completion pricing or{" "}
            <code className="text-xs">:free</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <AppLoaderPanel label="Loading settings…" className="py-6" />
          ) : (
            <>
              <div className="space-y-2 max-w-md">
                <Label>Vault secret (OpenRouter API key)</Label>
                {secrets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No secrets yet.{" "}
                    <Link href="/secrets" className="text-primary underline-offset-4 hover:underline">
                      Add a secret
                    </Link>{" "}
                    with your OpenRouter key, then pick it here.
                  </p>
                ) : (
                  <Select value={secretId || "__none__"} onValueChange={(v) => setSecretId(v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a vault entry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {secrets.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2 max-w-md">
                <Label>Free model</Label>
                {!secretId ? (
                  <p className="text-sm text-muted-foreground">
                    Select a vault secret first to load free models from OpenRouter.
                  </p>
                ) : modelsLoading ? (
                  <div className="flex items-center gap-2.5 py-2 text-sm text-muted-foreground">
                    <AppLoaderIcon aria-label="Loading models" />
                    <span>Loading free models…</span>
                  </div>
                ) : (
                  <Select
                    value={modelId || "__none__"}
                    onValueChange={(v) => setModelId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a free model" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(24rem,70vh)]">
                      <SelectItem value="__none__">None</SelectItem>
                      {modelOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                          <span className="block truncate max-w-[min(28rem,85vw)]" title={m.name}>
                            {m.id}
                            {m.name !== m.id ? ` — ${m.name}` : ""}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {savedAt ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved {savedAt}</p>
              ) : null}

              <Button onClick={handleSave} disabled={saving || loading}>
                {saving ? "Saving…" : "Save AI settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
