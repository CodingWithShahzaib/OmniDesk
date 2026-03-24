"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import {
  AppLoaderDots,
  AppLoaderPanel,
  AppLoaderSidebar,
} from "@/components/ui/app-loader";
import { NoteEditor } from "@/components/notes/note-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyNoteContentJson, NOTE_TITLE_MAX } from "@/lib/note-content";
import { cn } from "@/lib/utils";

type NoteListRow = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  createdAt: string;
};

type NoteDetail = NoteListRow & {
  contentJson: string;
  plainText: string | null;
};

export default function NotesPage() {
  const [list, setList] = useState<NoteListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NoteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [bodyJson, setBodyJson] = useState(emptyNoteContentJson());
  const [saving, setSaving] = useState(false);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFetchForIdRef = useRef<string | null>(null);

  const fetchList = useCallback(async (q: string) => {
    setListLoading(true);
    try {
      const url = q ? `/api/notes?q=${encodeURIComponent(q)}` : "/api/notes";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load notes");
      const data = (await res.json()) as NoteListRow[];
      setList(data);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList(searchQ);
  }, [fetchList, searchQ]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      setSearchQ(searchInput.trim());
    }, 320);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setTitleInput("");
      setBodyJson(emptyNoteContentJson());
      return;
    }

    if (skipFetchForIdRef.current === selectedId) {
      skipFetchForIdRef.current = null;
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/notes/${selectedId}`);
        if (!res.ok) {
          if (!cancelled) {
            setDetail(null);
            setSelectedId(null);
          }
          return;
        }
        const data = (await res.json()) as NoteDetail;
        if (cancelled) return;
        setDetail(data);
        setTitleInput(data.title);
        setBodyJson(data.contentJson);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!listLoading && list.length > 0 && selectedId === null) {
      setSelectedId(list[0].id);
    }
  }, [list, listLoading, selectedId]);

  useEffect(() => {
    if (
      selectedId &&
      list.length > 0 &&
      !list.some((n) => n.id === selectedId)
    ) {
      setSelectedId(list[0]?.id ?? null);
    }
  }, [list, selectedId]);

  const patchListRow = useCallback((id: string, patch: Partial<NoteListRow>) => {
    setList((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, ...patch } : n));
      next.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      return next;
    });
  }, []);

  const queueSaveContent = useCallback(
    (json: string, forId: string) => {
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
      contentTimerRef.current = setTimeout(() => {
        contentTimerRef.current = null;
        void (async () => {
          if (selectedIdRef.current !== forId) return;
          setSaving(true);
          try {
            const res = await fetch(`/api/notes/${forId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contentJson: json }),
            });
            if (!res.ok) return;
            const row = (await res.json()) as NoteDetail;
            patchListRow(forId, {
              preview: row.preview,
              updatedAt: row.updatedAt,
            });
          } finally {
            setSaving(false);
          }
        })();
      }, 650);
    },
    [patchListRow]
  );

  const queueSaveTitle = useCallback(
    (title: string, forId: string) => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(() => {
        titleTimerRef.current = null;
        void (async () => {
          if (selectedIdRef.current !== forId) return;
          setSaving(true);
          try {
            const res = await fetch(`/api/notes/${forId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            });
            if (!res.ok) return;
            const row = (await res.json()) as NoteDetail;
            patchListRow(forId, {
              title: row.title,
              preview: row.preview,
              updatedAt: row.updatedAt,
            });
          } finally {
            setSaving(false);
          }
        })();
      }, 450);
    },
    [patchListRow]
  );

  const handleNewNote = async () => {
    const res = await fetch("/api/notes", { method: "POST" });
    if (!res.ok) return;
    const row = (await res.json()) as NoteDetail;
    skipFetchForIdRef.current = row.id;
    const listRow: NoteListRow = {
      id: row.id,
      title: row.title,
      preview: row.preview,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
    setList((prev) => [listRow, ...prev]);
    setSelectedId(row.id);
    setDetail(row);
    setTitleInput(row.title);
    setBodyJson(row.contentJson);
    setDetailLoading(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setList((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
    }
  };

  const onTitleChange = (v: string) => {
    const t = v.slice(0, NOTE_TITLE_MAX);
    setTitleInput(t);
    if (selectedId) {
      patchListRow(selectedId, { title: t || "Untitled" });
      queueSaveTitle(t || "Untitled", selectedId);
    }
  };

  const onBodyChange = (json: string) => {
    setBodyJson(json);
    if (selectedId) {
      queueSaveContent(json, selectedId);
    }
  };

  const editorReady =
    selectedId &&
    detail &&
    detail.id === selectedId &&
    !detailLoading;

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 md:flex-row md:gap-0 md:rounded-2xl md:overflow-hidden md:border md:border-white/50 md:dark:border-white/10 md:shadow-[0_25px_80px_-45px_rgba(0,0,0,0.45)] md:bg-card/50 md:backdrop-blur-xl">
      <aside className="flex flex-col w-full md:w-[min(100%,320px)] md:shrink-0 rounded-xl border border-white/50 dark:border-white/10 md:rounded-none md:border-0 md:border-r md:border-white/40 dark:md:border-white/10 bg-card/60 backdrop-blur-md min-h-[200px] md:min-h-0">
        <div className="p-3 border-b border-white/40 dark:border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1 rounded-lg"
              onClick={() => void handleNewNote()}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New note
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search notes…"
              className="pl-9 rounded-lg bg-white/50 dark:bg-white/5 border-white/40 dark:border-white/10"
              aria-label="Search notes"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[120px]">
          {listLoading ? (
            <AppLoaderSidebar className="py-6" label="Loading notes…" />
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center px-3 py-8">
              {searchQ
                ? "No notes match your search."
                : "No notes yet. Create one to get started."}
            </p>
          ) : (
            list.map((n) => {
              const active = n.id === selectedId;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSelectedId(n.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "bg-muted text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <div className="font-medium truncate text-foreground">{n.title}</div>
                  {n.preview ? (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {n.preview}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-h-0 min-w-0 gap-3 md:gap-0">
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-6 py-16 border border-dashed border-white/40 dark:border-white/10 rounded-xl md:border-0 md:rounded-none">
            <FileText className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm text-center max-w-sm">
              Select a note from the list or create a new one.
            </p>
          </div>
        ) : detailLoading || !editorReady ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <AppLoaderPanel label="Opening note…" className="py-6" />
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 px-1 md:px-4 md:pt-4 md:pb-2">
              <Input
                value={titleInput}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Untitled"
                className="text-lg font-semibold tracking-tight border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 py-2 h-auto placeholder:text-muted-foreground/70"
                aria-label="Note title"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 mt-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete note"
                onClick={() => void handleDelete(selectedId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 px-3 md:px-4 text-xs text-muted-foreground min-h-[1.25rem]">
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <AppLoaderDots className="scale-[0.45] gap-1" />
                  Saving…
                </span>
              ) : (
                <span>Saved</span>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-4 md:px-4 md:pb-6">
              <NoteEditor
                key={selectedId}
                contentJson={bodyJson}
                onContentJsonChange={onBodyChange}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
