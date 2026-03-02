"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut, Calendar } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

interface DashboardLayoutProps {
  user: { id: string; email: string; name?: string | null };
  children: React.ReactNode;
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-20 bg-card border-b">
        <div className="h-12 px-4 flex items-center justify-between">
          <Link href="/" className="font-semibold">OmniDesk</Link>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r bg-card flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <Link href="/" className="font-semibold text-lg">
            OmniDesk
          </Link>
          <ModeToggle />
        </div>
        <nav className="flex-1 p-2 space-y-1">
          <Link
            href="/timesheet"
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-sm font-medium"
          >
            <Calendar className="h-4 w-4" />
            Timesheet Manager
          </Link>
        </nav>
        <div className="p-2 border-t">
          {user && (
            <div className="px-3 py-2 text-sm text-muted-foreground truncate">
              {user.email}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-4 md:p-6 bg-background">{children}</main>
    </div>
  );
}
