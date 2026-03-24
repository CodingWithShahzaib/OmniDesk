"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                title="Attachments coming soon"
                className="group gap-1.5 opacity-50"
              >
                <Paperclip className="w-4 h-4 shrink-0" />
                <span className="text-xs hidden sm:group-hover:inline transition-opacity">
                  Attach
                </span>
              </Button>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {streaming ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onStop}
                  className="gap-2"
                  aria-label="Stop generation"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span className="hidden sm:inline">Stop</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  disabled={!canSend}
                  onClick={() => {
                    if (!canSend) return;
                    onSubmit();
                    adjustHeight(true);
                  }}
                  aria-label="Send message"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </Button>
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="h-auto min-h-8 py-1.5 px-3 gap-1.5 text-xs font-normal text-muted-foreground hover:text-foreground"
    >
      <span className="shrink-0 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>
      <span>{label}</span>
    </Button>
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
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              disabled
              className="text-zinc-500 opacity-60 border-zinc-800 hover:bg-transparent"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              size="iconSm"
              disabled={!value.trim()}
              variant={value.trim() ? "secondary" : "ghost"}
              className={cn(
                value.trim()
                  ? "border border-zinc-600 bg-white text-black hover:bg-zinc-100"
                  : "text-zinc-500 border border-zinc-700 cursor-not-allowed"
              )}
            >
              <ArrowUpIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
