"use client";

import { cn } from "@/lib/utils";

export function AppLoaderDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-accent shadow-sm animate-loader-bounce"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

function LoaderGlowBackdrop() {
  return (
    <div
      className="pointer-events-none absolute -inset-10 rounded-[2rem] opacity-55 blur-3xl animate-pulse"
      style={{
        background:
          "conic-gradient(from 140deg at 50% 50%, hsl(var(--primary) / 0.4), hsl(var(--accent) / 0.32), hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.35), hsl(var(--primary) / 0.4))",
      }}
      aria-hidden
    />
  );
}

const ringDim = {
  xs: "h-4 w-4",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-16 w-16",
} as const;

export function AppLoaderRing({
  size = "md",
  className,
}: {
  size?: keyof typeof ringDim;
  className?: string;
}) {
  const spinBorder = size === "xs" ? "border" : "border-2";
  const trackBorder = size === "xs" ? "border" : "border-2";
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", ringDim[size], className)}
      aria-hidden
    >
      {size !== "xs" ? (
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/35 via-accent/25 to-primary/15 opacity-70 blur-md"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center rounded-full border-border/60 bg-background/50 shadow-inner backdrop-blur-sm dark:border-border/80",
          trackBorder
        )}
      >
        <div
          className={cn(
            "absolute rounded-full border-muted-foreground/25 border-t-primary border-r-accent/90 border-b-transparent border-l-transparent animate-spin",
            spinBorder,
            size === "xs" ? "inset-0" : "inset-[3px]"
          )}
          style={{ animationDuration: size === "xs" ? "0.7s" : "0.95s" }}
          aria-hidden
        />
        {size !== "xs" ? (
          <div
            className={cn(
              "rounded-full bg-primary/20",
              size === "sm" ? "h-[30%] w-[30%]" : size === "lg" ? "h-[32%] w-[32%]" : "h-[28%] w-[28%]"
            )}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

/** Full-area loader for session gates and empty states (glass card + orb + dots). */
export function AppPageLoader({
  className,
  label = "Loading",
  minHeight = "min-h-[400px]",
}: {
  className?: string;
  label?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-center p-6", minHeight, className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="relative">
        <LoaderGlowBackdrop />
        <div className="relative rounded-2xl border border-white/60 bg-card/85 shadow-[0_24px_90px_-48px_rgba(0,0,0,0.55)] backdrop-blur-2xl dark:border-white/10 px-11 py-9">
          <div className="flex flex-col items-center gap-6">
            <AppLoaderRing size="lg" />
            <div className="space-y-3 text-center">
              <p className="text-sm font-medium tracking-tight text-foreground/90">{label}</p>
              <AppLoaderDots />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Centered loader for cards and main content regions. */
export function AppLoaderPanel({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4 py-10 px-4", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? "Loading"}
    >
      <AppLoaderRing size="md" />
      {label ? <p className="text-center text-sm text-muted-foreground max-w-xs">{label}</p> : null}
      <AppLoaderDots />
    </div>
  );
}

/** Compact column for sidebars and narrow lists. */
export function AppLoaderSidebar({
  className,
  label = "Loading…",
}: {
  className?: string;
  label?: string | null;
}) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3 py-6 px-2", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label ?? "Loading"}
    >
      <AppLoaderRing size="sm" />
      <AppLoaderDots className="scale-90" />
      {label ? (
        <p className="text-center text-[11px] leading-snug text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}

/** Inline spinner for toolbars and form rows (replaces Lucide Loader2). */
export function AppLoaderIcon({
  className,
  "aria-label": ariaLabel = "Loading",
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0", className)} role="status" aria-label={ariaLabel}>
      <AppLoaderRing size="xs" />
    </span>
  );
}
