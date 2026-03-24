"use client";

import type { Editor } from "@tiptap/core";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Table,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TEXT_COLORS: { hex: string; label: string }[] = [
  { hex: "#ef4444", label: "Text red" },
  { hex: "#f97316", label: "Text orange" },
  { hex: "#22c55e", label: "Text green" },
  { hex: "#3b82f6", label: "Text blue" },
  { hex: "#a855f7", label: "Text purple" },
];

const HIGHLIGHTS: { hex: string; label: string }[] = [
  { hex: "#fef08a", label: "Highlight yellow" },
  { hex: "#bbf7d0", label: "Highlight green" },
  { hex: "#fecdd3", label: "Highlight pink" },
];

type NoteToolbarProps = {
  editor: Editor;
  onSetLink: () => void;
};

export function NoteToolbar({ editor, onSetLink }: NoteToolbarProps) {
  const currentTextColor = editor.getAttributes("textStyle").color as string | undefined;

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-white/40 dark:border-white/10 bg-white/50 dark:bg-white/5 px-2 py-1.5">
      <ToolbarBtn
        onClick={() => editor.chain().focus().undo().run()}
        label="Undo"
        disabled={!editor.can().undo()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().redo().run()}
        label="Redo"
        disabled={!editor.can().redo()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarDivider />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        label="Bold"
      >
        <Bold className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        label="Italic"
      >
        <Italic className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        label="Underline"
      >
        <Underline className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        label="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleSubscript().run()}
        active={editor.isActive("subscript")}
        label="Subscript"
      >
        <SubIcon className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
        active={editor.isActive("superscript")}
        label="Superscript"
      >
        <SupIcon className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarDivider />

      <span className="flex items-center gap-0.5 px-0.5" title="Text color">
        <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        {TEXT_COLORS.map(({ hex, label }) => (
          <ToolbarBtn
            key={hex}
            onClick={() =>
              editor.chain().focus().setColor(hex).run()
            }
            active={currentTextColor === hex}
            label={label}
            className="h-6 w-6"
          >
            <span
              className="h-3.5 w-3.5 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: hex }}
            />
          </ToolbarBtn>
        ))}
        <ToolbarBtn
          onClick={() => editor.chain().focus().unsetColor().run()}
          label="Reset text color"
          className="h-6 w-6 text-[10px] font-medium"
        >
          ∅
        </ToolbarBtn>
      </span>
      <ToolbarDivider />

      <span className="flex items-center gap-0.5 px-0.5" title="Highlight">
        <Highlighter className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        {HIGHLIGHTS.map(({ hex, label }) => (
          <ToolbarBtn
            key={hex}
            onClick={() =>
              editor.chain().focus().toggleHighlight({ color: hex }).run()
            }
            active={editor.isActive("highlight", { color: hex })}
            label={label}
            className="h-6 w-6"
          >
            <span
              className="h-3.5 w-3.5 rounded-sm border border-border"
              style={{ backgroundColor: hex }}
            />
          </ToolbarBtn>
        ))}
        <ToolbarBtn
          onClick={() => editor.chain().focus().unsetHighlight().run()}
          label="Remove highlight"
          className="h-6 px-1.5 text-[10px] font-medium"
        >
          clear
        </ToolbarBtn>
      </span>
      <ToolbarDivider />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        label="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        label="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        label="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarDivider />

      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        label="Align left"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        label="Align center"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        label="Align right"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        active={editor.isActive({ textAlign: "justify" })}
        label="Align justify"
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarDivider />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        label="Bullet list"
      >
        <List className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        label="Numbered list"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
        label="Task list"
      >
        <ListTodo className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        label="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarDivider />

      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        label="Inline code"
      >
        <span
          className="text-[11px] font-mono font-semibold leading-none select-none"
          aria-hidden
        >
          &lt;&gt;
        </span>
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        label="Code block"
      >
        <span className="text-[10px] font-mono font-semibold px-0.5">{"{}"}</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={onSetLink} active={editor.isActive("link")} label="Link">
        <LinkIcon className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => insertImage(editor)} label="Insert image">
        <ImageIcon className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="Horizontal rule"
      >
        <Minus className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarDivider />

      <ToolbarBtn
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        label="Insert table"
      >
        <Table className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn
        onClick={() => editor.chain().focus().deleteTable().run()}
        label="Delete table"
        disabled={!editor.can().deleteTable()}
      >
        <Trash2 className="h-4 w-4" />
      </ToolbarBtn>
    </div>
  );
}

function insertImage(editor: Editor) {
  const prev = window.prompt("Image URL (https://…)", "https://");
  if (prev === null) return;
  const src = prev.trim();
  if (!src) return;
  const ok =
    /^https?:\/\//i.test(src) || src.startsWith("data:image/");
  if (!ok) {
    window.alert("Please use an http(s) URL or a data:image URL.");
    return;
  }
  editor.chain().focus().setImage({ src }).run();
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border self-center" aria-hidden />;
}

function ToolbarBtn({
  children,
  onClick,
  active,
  disabled,
  label,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 shrink-0 rounded-md",
        active && "bg-white/80 dark:bg-white/15 ring-1 ring-white/50 dark:ring-white/10",
        className
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}
