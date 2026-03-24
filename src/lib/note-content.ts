import { generateText, type Extensions, type JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";

export const NOTE_TITLE_MAX = 200;
export const NOTE_CONTENT_JSON_MAX_BYTES = 1_000_000;

export const EMPTY_NOTE_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * Full editor schema: StarterKit (minus duplicate Link) + common open-source TipTap extensions.
 * Paid/cloud products (collab, AI, comments, etc.) are not included.
 */
export function getNoteExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      protocols: ["http", "https", "mailto", "tel"],
      HTMLAttributes: {
        class: "note-content-link",
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    TextStyleKit.configure({
      backgroundColor: false,
      fontFamily: false,
      fontSize: false,
      lineHeight: false,
    }),
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({
      HTMLAttributes: { class: "note-editor-image" },
    }),
    TableKit.configure({
      table: {
        resizable: false,
        HTMLAttributes: { class: "note-editor-table" },
      },
    }),
    Typography,
  ];
}

export function emptyNoteContentJson(): string {
  return JSON.stringify(EMPTY_NOTE_DOC);
}

export function plainTextFromContentJson(json: string): string {
  let doc: JSONContent;
  try {
    doc = JSON.parse(json) as JSONContent;
  } catch {
    return "";
  }
  try {
    return generateText(doc, getNoteExtensions()).trim();
  } catch {
    return "";
  }
}

export function previewFromPlainText(plain: string | null, maxLen = 120): string {
  if (!plain) return "";
  const t = plain.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}
