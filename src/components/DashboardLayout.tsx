"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { authClient } from "@/lib/auth-client";
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
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from "@/components/ui/sidebar";

interface DashboardLayoutProps {
  user: { id: string; email: string; name?: string | null };
  children: React.ReactNode;
}

function SidebarSignOut({ onSignOut }: { onSignOut: () => void }) {
  const { open, animate } = useSidebar();
  return (
    <button
      type="button"
      onClick={onSignOut}
      className="flex items-center justify-start gap-2 group/sidebar py-2 w-full text-left rounded-md hover:bg-neutral-200/80 dark:hover:bg-neutral-700/50 transition-colors"
    >
      <LogOut className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        Sign out
      </motion.span>
    </button>
  );
}

function OmniLogo({ expanded }: { expanded: boolean }) {
  return (
    <Link
      href="/"
      className="font-normal flex space-x-2 items-center text-sm text-black dark:text-white py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      {expanded && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-medium text-black dark:text-white whitespace-pre"
        >
          OmniDesk
        </motion.span>
      )}
    </Link>
  );
}

export function DashboardLayout({ user, children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
  };

  const navLinks = [
    { href: "/timesheet", label: "Timesheet Manager", icon: Calendar },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/notes", label: "Notes", icon: StickyNote },
    { href: "/secrets", label: "Secret Vault", icon: KeyRound },
  ] as const;

  const settingsHref = "/settings";
  const settingsActive = pathname?.startsWith(settingsHref);

  const displayName = user.name?.trim() || user.email;

  return (
    <div className="fixed inset-0 z-0 flex min-h-0 w-full flex-col overflow-hidden bg-background md:flex-row">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody
          className="justify-between gap-10 md:sticky md:top-0 md:h-full md:min-h-0 md:max-h-full"
          mobileLeading={
            <Link
              href="/"
              className="font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 shrink-0"
            >
              OmniDesk
            </Link>
          }
        >
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            <SidebarOpenLogo />
            <div className="mt-6 md:mt-8 flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname?.startsWith(link.href);
                const Icon = link.icon;
                return (
                  <SidebarLink
                    key={link.href}
                    link={{
                      href: link.href,
                      label: link.label,
                      icon: (
                        <Icon className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                      ),
                    }}
                    className={cn(
                      "rounded-lg px-2 -mx-2",
                      isActive &&
                        "bg-neutral-200/90 dark:bg-neutral-700/80 font-medium"
                    )}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-neutral-200 dark:border-neutral-600 pt-4 mt-4">
            <div
              className={cn(
                "flex items-center gap-2",
                "md:justify-start justify-between"
              )}
            >
              <ModeToggle />
            </div>
            <SidebarLink
              link={{
                label: "Settings",
                href: settingsHref,
                icon: (
                  <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                ),
              }}
              className={cn(
                "rounded-lg px-2 -mx-2",
                settingsActive &&
                  "bg-neutral-200/90 dark:bg-neutral-700/80 font-medium"
              )}
            />
            <SidebarLink
              link={{
                label: displayName,
                href: settingsHref,
                icon: (
                  <Image
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
                    className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                    width={28}
                    height={28}
                    alt=""
                  />
                ),
              }}
            />
            <SidebarSignOut onSignOut={handleSignOut} />
          </div>
        </SidebarBody>
      </Sidebar>
      <main
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-background/80 backdrop-blur-sm",
          pathname?.startsWith("/chat") || pathname?.startsWith("/notes")
            ? "flex flex-col p-2 md:p-3"
            : "p-4 md:p-8"
        )}
      >
        <div
          className={cn(
            "mx-auto min-w-0 w-full",
            pathname?.startsWith("/chat") || pathname?.startsWith("/notes")
              ? "max-w-none min-h-0 flex flex-1 flex-col"
              : "max-w-6xl space-y-6"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarOpenLogo() {
  const { open } = useSidebar();
  return <OmniLogo expanded={open} />;
}
