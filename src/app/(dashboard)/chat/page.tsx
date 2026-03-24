"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChatMessageMarkdown } from "@/components/chat-message-markdown";
import { V0ChatComposer, type V0ChatSuggestion } from "@/components/ui/v0-ai-chat";
import {
  mergeAbortSignals,
  streamAppChatMessages,
} from "@/lib/chat-sse-client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  ChevronsUpDown,
  FileCode2,
  LayoutList,
  Menu,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AppLoaderIcon,
  AppLoaderPanel,
  AppLoaderSidebar,
  AppPageLoader,
} from "@/components/ui/app-loader";

type ChatSessionRow = {
  id: string;
  title: string;
  modelId: string | null;
  updatedAt: string;
  createdAt?: string;
};

type ChatMessageRow = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type OrModel = { id: string; name: string };

const CHAT_SUGGESTIONS: V0ChatSuggestion[] = [
  {
    label: "Summarize week",
    prompt: "Summarize my week in three bullets…",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    label: "Explain error",
    prompt: "Explain this TypeScript error in plain English…",
    icon: <FileCode2 className="h-4 w-4" />,
  },
  {
    label: "Standup draft",
    prompt: "Draft a concise standup update…",
    icon: <LayoutList className="h-4 w-4" />,
  },
  {
    label: "Priorities",
    prompt: "What should I prioritize next?",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    label: "Rewrite",
    prompt: "Rewrite this more professionally…",
    icon: <Type className="h-4 w-4" />,
  },
];

function formatModelLabel(fullId: string): string {
  const t = fullId.trim();
  const slug = t.includes("/") ? (t.split("/").pop() ?? t) : t;
  if (slug.length <= 40) return slug;
  return `${slug.slice(0, 18)}…${slug.slice(-14)}`;
}

export default function ChatPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [settingsSecretId, setSettingsSecretId] = useState("");
  const [settingsModelId, setSettingsModelId] = useState("");
  const [allModels, setAllModels] = useState<OrModel[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamNonce, setStreamNonce] = useState(0);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const composerDraftRef = useRef(composerDraft);
  composerDraftRef.current = composerDraft;
  const streamParamsRef = useRef<{ sessionId: string; content: string } | null>(
    null
  );
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const streamBubbleRef = useRef<HTMLDivElement | null>(null);
  /** After inline session create + first send, avoid loadThread wiping optimistic messages. */
  const skipNextThreadLoadRef = useRef<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  );

  const effectiveModelId =
    activeSession?.modelId?.trim() ||
    settingsModelId.trim() ||
    "";

  const catalogForPicker = useMemo(() => {
    const seen = new Set(allModels.map((m) => m.id));
    const list = [...allModels];
    if (effectiveModelId && !seen.has(effectiveModelId)) {
      list.push({
        id: effectiveModelId,
        name: `${effectiveModelId} (current)`,
      });
    }
    return list.sort((a, b) => a.id.localeCompare(b.id));
  }, [allModels, effectiveModelId]);

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return catalogForPicker;
    return catalogForPicker.filter(
      (m) =>
        m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  }, [catalogForPicker, modelSearch]);

  const modelButtonLabel = useMemo(() => {
    if (!effectiveModelId) return "Choose model…";
    if (!activeSession?.modelId?.trim() && settingsModelId.trim()) {
      return `Default: ${effectiveModelId}`;
    }
    return effectiveModelId;
  }, [effectiveModelId, activeSession?.modelId, settingsModelId]);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/chat/sessions", { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as ChatSessionRow[];
    setSessions(Array.isArray(data) ? data : []);
    return data;
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        messages: ChatMessageRow[];
        title: string;
        modelId: string | null;
      };
      setMessages(data.messages ?? []);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, title: data.title, modelId: data.modelId }
            : s
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setError("");
      try {
        const [setRes] = await Promise.all([
          fetch("/api/settings", { credentials: "include" }),
          loadSessions().catch(() => []),
        ]);
        if (!setRes.ok) throw new Error(await setRes.text());
        const cfg = (await setRes.json()) as {
          openRouterModelId: string | null;
          openRouterSecretId: string | null;
        };
        if (cancelled) return;
        setSettingsSecretId(cfg.openRouterSecretId ?? "");
        setSettingsModelId(cfg.openRouterModelId ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, loadSessions]);

  useEffect(() => {
    if (!session?.user || !settingsSecretId) {
      setAllModels([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      try {
        const res = await fetch(
          `/api/openrouter/models?secretId=${encodeURIComponent(settingsSecretId)}`,
          { credentials: "include" }
        );
        const data = (await res.json()) as {
          message?: string;
          models?: OrModel[];
        };
        if (!res.ok) throw new Error(data.message || `Models ${res.status}`);
        if (cancelled) return;
        let list: OrModel[] = Array.isArray(data.models)
          ? [...data.models]
          : [];
        const hasFreeRouter = list.some(
          (m) => m.id.toLowerCase() === "openrouter/free"
        );
        if (!hasFreeRouter) {
          list.unshift({
            id: "openrouter/free",
            name: "OpenRouter — free auto-router",
          });
        }
        setAllModels(list.sort((a, b) => a.id.localeCompare(b.id)));
      } catch {
        if (!cancelled) setAllModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, settingsSecretId]);

  useEffect(() => {
    if (!activeId) return;
    if (skipNextThreadLoadRef.current === activeId) {
      skipNextThreadLoadRef.current = null;
      return;
    }
    loadThread(activeId);
  }, [activeId, loadThread]);

  useEffect(() => {
    setComposerDraft("");
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, streamNonce, streamingText]);

  useEffect(() => {
    if (!streaming) return;
    const el = streamBubbleRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [streaming, streamNonce, streamingText]);

  const handleNewChat = async () => {
    setError("");
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat", modelId: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const row = (await res.json()) as ChatSessionRow;
      setSessions((prev) => [row, ...prev.filter((s) => s.id !== row.id)]);
      setActiveId(row.id);
      setMessages([]);
      setMobileSidebar(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create chat");
    }
  };

  const handleSelectSession = (id: string) => {
    setActiveId(id);
    setMobileSidebar(false);
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    setError("");
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleRename = async () => {
    if (!activeId) return;
    const t = renameValue.trim().slice(0, 200);
    if (!t) return;
    setError("");
    try {
      const res = await fetch(`/api/chat/sessions/${activeId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!res.ok) throw new Error(await res.text());
      const row = (await res.json()) as ChatSessionRow;
      setSessions((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, ...row } : s))
      );
      setRenameOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    }
  };

  const handleModelChange = async (value: string) => {
    if (!activeId) return;
    const modelId = value === "__none__" ? null : value;
    setError("");
    try {
      const res = await fetch(`/api/chat/sessions/${activeId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const row = (await res.json()) as ChatSessionRow;
      setSessions((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, modelId: row.modelId } : s))
      );
      setModelPickerOpen(false);
      setModelSearch("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update model");
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamingText("");
    streamParamsRef.current = null;
    if (activeId) void loadThread(activeId);
  };

  const handleStreamComplete = useCallback(async () => {
    setStreaming(false);
    abortRef.current = null;
    const id = activeId;
    if (id) {
      await loadThread(id);
      await loadSessions();
    }
    streamParamsRef.current = null;
  }, [activeId, loadThread, loadSessions]);

  const handleStreamError = useCallback(
    async (err: unknown) => {
      setError(err instanceof Error ? err.message : "Stream failed");
      setStreaming(false);
      setStreamingText("");
      abortRef.current = null;
      streamParamsRef.current = null;
      if (activeId) await loadThread(activeId);
    },
    [activeId, loadThread]
  );

  useEffect(() => {
    if (!streaming) {
      setStreamingText("");
      return;
    }

    const p = streamParamsRef.current;
    const parentAc = abortRef.current;
    if (!p || !parentAc) return;

    const localAc = new AbortController();
    const merged = mergeAbortSignals([parentAc.signal, localAc.signal]);

    let cancelled = false;
    let rafId = 0;
    let pending = "";

    const flush = () => {
      rafId = 0;
      if (!pending) return;
      const chunk = pending;
      pending = "";
      setStreamingText((prev) => prev + chunk);
    };

    const scheduleFlush = () => {
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    (async () => {
      try {
        for await (const text of streamAppChatMessages(
          p.sessionId,
          p.content,
          merged
        )) {
          if (cancelled) break;
          pending += text;
          scheduleFlush();
        }
        if (rafId) cancelAnimationFrame(rafId);
        flush();
        if (!cancelled && !parentAc.signal.aborted) {
          await handleStreamComplete();
        }
      } catch (e) {
        if (cancelled) return;
        const aborted =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && e.name === "AbortError");
        if (aborted) {
          setStreaming(false);
          setStreamingText("");
          streamParamsRef.current = null;
          abortRef.current = null;
          if (activeId) void loadThread(activeId);
          return;
        }
        void handleStreamError(e);
      }
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      localAc.abort();
    };
  }, [
    streaming,
    streamNonce,
    activeId,
    handleStreamComplete,
    handleStreamError,
    loadThread,
  ]);

  const handleSend = useCallback(async () => {
    const text = composerDraftRef.current.trim();
    if (!text || streaming) return;
    if (!settingsSecretId || !effectiveModelId.trim()) {
      setError(
        "Add an OpenRouter API key (Secret Vault + Settings), then pick a model with the model button or set a default in Settings."
      );
      return;
    }

    let sessionId = activeId;
    if (!sessionId) {
      setError("");
      try {
        const res = await fetch("/api/chat/sessions", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "New chat", modelId: null }),
        });
        if (!res.ok) throw new Error(await res.text());
        const row = (await res.json()) as ChatSessionRow;
        sessionId = row.id;
        skipNextThreadLoadRef.current = sessionId;
        setSessions((prev) => [row, ...prev.filter((s) => s.id !== row.id)]);
        setActiveId(sessionId);
        setMobileSidebar(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start chat");
        return;
      }
    }

    setError("");
    setComposerDraft("");
    const userMsg: ChatMessageRow = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) =>
      activeId ? [...prev, userMsg] : [userMsg]
    );

    if (!sessionId) return;

    const ac = new AbortController();
    abortRef.current = ac;
    streamParamsRef.current = { sessionId, content: text };
    setStreamingText("");
    setStreamNonce((n) => n + 1);
    setStreaming(true);
  }, [activeId, streaming, settingsSecretId, effectiveModelId]);

  if (sessionPending) {
    return <AppPageLoader />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please sign in to use Chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      {!settingsSecretId ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 shrink-0">
          Add an OpenRouter API key in{" "}
          <Link href="/secrets" className="underline font-medium">
            Secret Vault
          </Link>
          , then select that vault entry in{" "}
          <Link href="/settings" className="underline font-medium">
            Settings
          </Link>
          .
        </div>
      ) : !effectiveModelId.trim() ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100 shrink-0">
          Choose a model with the{" "}
          <span className="font-medium">Model</span> button, or set a default in{" "}
          <Link href="/settings" className="underline font-medium">
            Settings
          </Link>
          .
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive shrink-0">{error}</p>
      ) : null}

      <div
        className={cn(
          "flex flex-1 min-h-0 rounded-2xl border border-border bg-card/90 backdrop-blur-xl shadow-sm overflow-hidden",
          "h-[calc(100dvh-5.25rem)] max-h-[calc(100dvh-5.25rem)]",
          "md:h-[calc(100dvh-3.25rem)] md:max-h-[calc(100dvh-3.25rem)]"
        )}
      >
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/50 md:hidden",
            mobileSidebar ? "block" : "hidden"
          )}
          aria-hidden
          onClick={() => setMobileSidebar(false)}
        />

        <aside
          className={cn(
            "flex flex-col w-[17rem] shrink-0 border-r border-border bg-muted/25",
            "md:relative md:flex",
            mobileSidebar
              ? "fixed inset-y-0 left-0 z-50 flex max-h-[calc(100dvh-5.25rem)]"
              : "hidden md:flex"
          )}
        >
          <div className="p-2.5 border-b border-border flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 justify-start gap-1.5 font-medium"
              onClick={handleNewChat}
              disabled={listLoading}
            >
              <Plus className="h-4 w-4 opacity-80" />
              New chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {listLoading ? (
              <AppLoaderSidebar className="py-4" label="Loading chats…" />
            ) : sessions.length === 0 ? (
              <p className="text-xs text-foreground/70 leading-relaxed px-2 py-2.5">
                No chats yet. Send a message below to create one.
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-foreground/90",
                    s.id === activeId
                      ? "bg-background shadow-sm ring-1 ring-border"
                      : "hover:bg-muted/70"
                  )}
                >
                  <button
                    type="button"
                    className="flex-1 text-left truncate min-w-0"
                    onClick={() => handleSelectSession(s.id)}
                  >
                    {s.title}
                  </button>
                  <Button
                    variant="ghost"
                    size="iconXs"
                    className="shrink-0 opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    aria-label="Delete chat"
                    onClick={() => handleDeleteSession(s.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background/40">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0 flex-wrap bg-muted/15">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileSidebar(true)}
              aria-label="Open chats"
            >
              <Menu className="h-4 w-4" />
            </Button>
            {!activeId ? (
              <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                <span className="text-sm font-medium text-foreground">
                  New conversation
                </span>
                {settingsSecretId && effectiveModelId.trim() ? (
                  <span
                    className="inline-flex items-center max-w-full min-w-0 rounded-md border border-border bg-background/80 px-2 py-1 font-mono text-[11px] leading-tight text-foreground/85"
                    title={effectiveModelId}
                  >
                    <span className="truncate">{formatModelLabel(effectiveModelId)}</span>
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  asChild
                >
                  <Link href="/settings">Change in Settings</Link>
                </Button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium truncate flex-1 min-w-[8rem]">
                  {activeSession?.title ?? "Chat"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => {
                    setRenameValue(activeSession?.title ?? "");
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </Button>
                <div className="flex items-center gap-2 w-full sm:w-auto sm:max-w-[min(100%,28rem)]">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    Model
                  </Label>
                  {!settingsSecretId ? (
                    <span className="text-xs text-muted-foreground">
                      Set secret in Settings
                    </span>
                  ) : modelsLoading ? (
                    <AppLoaderIcon aria-label="Loading models" />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 min-w-0 max-w-full justify-between gap-2 px-2 font-mono text-xs"
                      onClick={() => {
                        setModelSearch("");
                        setModelPickerOpen(true);
                      }}
                    >
                      <span className="truncate text-left">{modelButtonLabel}</span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0 flex flex-col">
            {!activeId ? (
              <div className="flex-1 min-h-[4rem]" aria-hidden />
            ) : threadLoading && messages.length === 0 ? (
              <div className="flex justify-center py-12">
                <AppLoaderPanel label="Loading messages…" className="py-4" />
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[min(100%,56rem)] rounded-2xl px-3 py-2 text-sm min-w-0 break-words",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground whitespace-pre-wrap shadow-sm"
                          : "bg-muted/40 border border-border"
                      )}
                    >
                      {m.role === "assistant" ? (
                        <ChatMessageMarkdown content={m.content} />
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}
                {streaming ? (
                  <div className="flex justify-start">
                    <div
                      ref={streamBubbleRef}
                      className="max-w-[min(100%,56rem)] min-w-0 rounded-2xl px-3 py-2 text-sm bg-muted/25 border border-dashed border-border"
                    >
                      <ChatMessageMarkdown
                        content={streamingText}
                        className="text-foreground"
                      />
                    </div>
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 sm:px-4 sm:pb-4 sm:pt-3 shrink-0 bg-muted/10">
            <V0ChatComposer
              className="max-w-none w-full"
              value={composerDraft}
              onChange={setComposerDraft}
              onSubmit={() => void handleSend()}
              disabled={
                streaming ||
                !settingsSecretId ||
                !effectiveModelId.trim()
              }
              streaming={streaming}
              onStop={stopStreaming}
              placeholder={
                activeId
                  ? "Message… (Shift+Enter for newline)"
                  : "Type a message to start a new chat…"
              }
              showHero={
                Boolean(
                  (!activeId ||
                    (activeId && !threadLoading && messages.length === 0)) &&
                    !streaming
                )
              }
              heroTitle="What would you like to work on?"
              suggestions={
                settingsSecretId && effectiveModelId.trim()
                  ? CHAT_SUGGESTIONS
                  : []
              }
              onSuggestion={(prompt) => {
                setComposerDraft(prompt);
              }}
            />
          </div>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
            placeholder="Title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modelPickerOpen}
        onOpenChange={(open) => {
          setModelPickerOpen(open);
          if (!open) setModelSearch("");
        }}
      >
        <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] max-h-[min(85vh,720px)] flex flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-border text-left">
            <DialogTitle>Choose model</DialogTitle>
            <p className="text-xs text-muted-foreground font-normal pt-1">
              Full OpenRouter catalog (free and paid). Search by id or name.
            </p>
          </DialogHeader>
          <div className="px-3 py-2 shrink-0 relative border-b border-border/60">
            <Search className="pointer-events-none absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder="Search models…"
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start font-normal h-auto py-2.5 px-3 text-left"
              onClick={() => void handleModelChange("__none__")}
            >
              <span className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">Use Settings default</span>
                <span className="text-xs text-muted-foreground font-mono truncate max-w-full">
                  {settingsModelId.trim() || "No default set in Settings"}
                </span>
              </span>
            </Button>
            {filteredModels.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-6 text-center">
                No models match your search.
              </p>
            ) : (
              filteredModels.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start font-normal h-auto min-h-0 py-2 px-3 text-left whitespace-normal"
                  onClick={() => void handleModelChange(m.id)}
                >
                  <span className="flex flex-col items-start gap-0.5 min-w-0 w-full">
                    <span className="font-mono text-xs break-all text-left">
                      {m.id}
                    </span>
                    {m.name !== m.id ? (
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {m.name}
                      </span>
                    ) : null}
                  </span>
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
