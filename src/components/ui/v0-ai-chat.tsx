"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ArrowUpIcon,
  Paperclip,
  Square,
} from "lucide-react";

export interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

export function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(
          textarea.scrollHeight,
          maxHeight ?? Number.POSITIVE_INFINITY
        )
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export type V0ChatSuggestion = {
  label: string;
  icon: ReactNode;
  /** Text inserted into the composer when the chip is clicked */
  prompt: string;
};

export type V0ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  streaming?: boolean;
  onStop?: () => void;
  placeholder?: string;
  /** v0-style headline above the input (e.g. empty thread) */
  showHero?: boolean;
  heroTitle?: string;
  suggestions?: V0ChatSuggestion[];
  onSuggestion?: (prompt: string) => void;
  className?: string;
};

/**
 * v0-inspired composer: dark panel, auto-resize textarea, attach slot, send / stop.
 */
export function V0ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  streaming = false,
  onStop,
  placeholder = "Message…",
  showHero = false,
  heroTitle = "What can I help you ship?",
  suggestions = [],
  onSuggestion,
  className,
}: V0ChatComposerProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !streaming && value.trim()) {
        onSubmit();
        adjustHeight(true);
      }
    }
  };

  const canSend = value.trim().length > 0 && !disabled && !streaming;

  return (
    <div
      className={cn(
        "flex flex-col items-stretch w-full max-w-3xl mx-auto gap-3",
        className
      )}
    >
      {showHero ? (
        <div className="px-1">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
            {heroTitle}
          </h2>
        </div>
      ) : null}

      <div className="w-full">
        <div
          className={cn(
            "relative rounded-xl border shadow-sm overflow-hidden",
            "bg-background/80 dark:bg-background/60",
            "border-border",
            "ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
          )}
        >
          <div className="overflow-y-auto max-h-[min(40vh,220px)]">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || streaming}
              className={cn(
                "w-full px-4 py-3",
                "resize-none",
                "bg-transparent",
                "border-none shadow-none",
                "text-foreground text-sm leading-relaxed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0",
                "placeholder:text-muted-foreground placeholder:text-sm",
                "min-h-[60px]",
                "disabled:opacity-50"
              )}
              style={{ overflow: "hidden" }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 px-2 py-2 sm:px-3 sm:py-2.5 border-t border-border/80 bg-muted/20">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                disabled
                title="Attachments coming soon"
                className="group p-2 rounded-lg transition-colors flex items-center gap-1 text-muted-foreground cursor-not-allowed opacity-50"
              >
                <Paperclip className="w-4 h-4 shrink-0" />
                <span className="text-xs hidden sm:group-hover:inline transition-opacity text-muted-foreground">
                  Attach
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {streaming ? (
                <button
                  type="button"
                  onClick={onStop}
                  className="px-3 py-2 rounded-lg text-sm transition-colors border border-border bg-muted/80 text-foreground hover:bg-muted flex items-center gap-2"
                  aria-label="Stop generation"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => {
                    if (!canSend) return;
                    onSubmit();
                    adjustHeight(true);
                  }}
                  className={cn(
                    "h-9 w-9 sm:h-9 sm:w-9 rounded-full text-sm transition-colors flex items-center justify-center",
                    canSend
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                  )}
                  aria-label="Send message"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {suggestions.length > 0 && onSuggestion ? (
          <div className="flex flex-wrap items-start sm:items-center gap-2 mt-3 px-0.5">
            {suggestions.map((s) => (
              <SuggestionChip
                key={s.label}
                icon={s.icon}
                label={s.label}
                onClick={() => {
                  onSuggestion(s.prompt);
                  requestAnimationFrame(() => adjustHeight());
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SuggestionChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors bg-muted/30 border-border/80 hover:bg-muted/60 hover:border-border text-muted-foreground hover:text-foreground text-xs"
    >
      <span className="shrink-0 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/** Standalone demo layout (optional marketing-style page). */
export function VercelV0Chat() {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        setValue("");
        adjustHeight(true);
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8">
      <h1 className="text-4xl font-bold text-foreground text-center">
        What can I help you ship?
      </h1>
      <div className="w-full">
        <div className="relative bg-zinc-950 rounded-xl border border-zinc-800 dark:bg-neutral-950 dark:border-neutral-800">
          <div className="overflow-y-auto">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              className={cn(
                "w-full px-4 py-3 resize-none bg-transparent border-none text-zinc-100 text-sm",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                "placeholder:text-zinc-500 placeholder:text-sm min-h-[60px]"
              )}
              style={{ overflow: "hidden" }}
            />
          </div>
          <div className="flex items-center justify-between p-3 border-t border-zinc-800">
            <button
              type="button"
              disabled
              className="p-2 rounded-lg text-zinc-500 cursor-not-allowed opacity-60"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!value.trim()}
              className={cn(
                "px-2.5 py-2.5 rounded-lg border transition-colors",
                value.trim()
                  ? "bg-white text-black border-zinc-200"
                  : "text-zinc-500 border-zinc-700 cursor-not-allowed"
              )}
            >
              <ArrowUpIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
