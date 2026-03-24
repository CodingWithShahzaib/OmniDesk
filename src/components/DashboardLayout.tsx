"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Calendar,
  KeyRound,
  Settings,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  user: { id: string; email: string; name?: string | null };
  children: React.ReactNode;
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  const links = [
    { href: "/timesheet", label: "Timesheet Manager", icon: Calendar },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/notes", label: "Notes", icon: StickyNote },
    { href: "/secrets", label: "Secret Vault", icon: KeyRound },
  ];

  const settingsHref = "/settings";
  const settingsActive = pathname?.startsWith(settingsHref);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-white/40 dark:border-white/10 shadow-[0_10px_40px_-28px_rgba(0,0,0,0.55)]">
        <div className="h-14 px-4 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            OmniDesk
          </Link>
          <div className="flex items-center gap-1.5">
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label="Settings"
              className="rounded-full border border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur"
            >
              <Link href={settingsHref}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="rounded-full border border-white/40 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-white/50 dark:border-white/10 bg-card/70 backdrop-blur-2xl flex-col shadow-[0_25px_80px_-45px_rgba(0,0,0,0.6)]">
        <div className="p-5 border-b border-white/40 dark:border-white/10 flex items-center justify-between">
          <div>
            <Link href="/" className="font-semibold text-lg leading-tight tracking-tight">
              OmniDesk
            </Link>
            <p className="text-xs text-muted-foreground">Productivity, simplified</p>
          </div>
          <ModeToggle />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((link) => {
            const isActive = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white/80 text-foreground shadow-sm ring-1 ring-white/60 dark:bg-white/10 dark:ring-white/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/5"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/40 dark:border-white/10 space-y-1">
          <Link
            href={settingsHref}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              settingsActive
                ? "bg-white/80 text-foreground shadow-sm ring-1 ring-white/60 dark:bg-white/10 dark:ring-white/10"
                : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/5"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          {user && (
            <div className="px-3 py-2 rounded-lg bg-white/60 dark:bg-white/5 text-sm text-muted-foreground truncate">
              {user.email}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start hover:bg-white/70 dark:hover:bg-white/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>
      <main
        className={cn(
          "flex-1 overflow-auto bg-background/80 backdrop-blur-sm",
          pathname?.startsWith("/chat") || pathname?.startsWith("/notes")
            ? "flex flex-col min-h-0 p-2 md:p-3"
            : "p-4 md:p-8"
        )}
      >
        <div
          className={cn(
            "mx-auto",
            pathname?.startsWith("/chat") || pathname?.startsWith("/notes")
              ? "max-w-none w-full min-h-0 flex flex-1 flex-col"
              : "max-w-6xl space-y-6"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
