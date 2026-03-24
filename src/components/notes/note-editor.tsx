"use client";

import { useCallback, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { NoteToolbar } from "@/components/notes/note-toolbar";
import { EMPTY_NOTE_DOC, getNoteExtensions } from "@/lib/note-content";
import { cn } from "@/lib/utils";

type NoteEditorProps = {
  contentJson: string;
  onContentJsonChange: (json: string) => void;
  disabled?: boolean;
  className?: string;
};

export function NoteEditor({
  contentJson,
  onContentJsonChange,
  disabled,
  className,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      ...getNoteExtensions(),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],
    content: parseNoteDoc(contentJson),
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "notes-editor notes-editor-prose w-full max-w-none text-sm leading-relaxed",
          "min-h-[min(50vh,420px)] py-3 pl-8 pr-3"
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onContentJsonChange(JSON.stringify(ed.getJSON()));
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === "") {
      if (editor.isActive("link")) {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      }
      return;
    }
    const href =
      /^(https?:|mailto:|tel:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (editor.state.selection.empty) {
      const label =
        href.replace(/^mailto:/i, "").replace(/^https?:\/\//i, "").split("/")[0] ||
        trimmed;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[min(50vh,420px)] rounded-lg border border-white/40 bg-white/40 dark:border-white/10 dark:bg-white/5 animate-pulse",
          className
        )}
      />
    );
  }

  return (
    <div className={cn("rounded-xl border border-white/50 dark:border-white/10", className)}>
      <NoteToolbar editor={editor} onSetLink={setLink} />
      <div className="rounded-b-xl bg-card/40 backdrop-blur-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function parseNoteDoc(json: string): object {
  try {
    const doc = JSON.parse(json) as { type?: string };
    if (doc && typeof doc === "object" && doc.type === "doc") return doc;
  } catch {
    /* ignore */
  }
  return EMPTY_NOTE_DOC;
}
