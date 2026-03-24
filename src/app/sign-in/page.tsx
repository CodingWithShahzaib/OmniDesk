"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/timesheet",
    });
    setLoading(false);
    if (result.error) {
      setError(result.error.message || "Sign in failed");
      return;
    }
    // Full page redirect ensures cookie is sent on next request
    window.location.href = "/timesheet";
  };

  return (
    <div className="relative min-h-screen grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
      </div>

      {/* Left visual panel (hidden on mobile) */}
      <div className="relative hidden md:flex flex-col justify-between bg-gradient-to-br from-primary/15 via-accent/10 to-transparent px-12 py-14">
        <div className="space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/60 dark:bg-white/10 px-4 py-2 text-xs text-muted-foreground ring-1 ring-white/50 backdrop-blur">
            <span>Welcome to</span>
            <span className="font-semibold text-foreground">OmniDesk</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Your daily productivity hub
            </h1>
            <p className="text-muted-foreground">
              Track tasks, share updates, and export monthly timesheets with a calm, focused workspace.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Secure sign-in with theme toggle built in.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Modern glassmorphic surfaces to reduce visual noise.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Export-ready timesheets without leaving the dashboard.
              </li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: Switch themes anytime — OmniDesk remembers your choice.
        </p>
      </div>

      {/* Right auth panel */}
      <div className="relative flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to access your OmniDesk workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="bg-white/80 dark:bg-white/5 backdrop-blur"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="bg-white/80 dark:bg-white/5 backdrop-blur"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-center pt-1">
                <LiquidMetalButton
                  type="submit"
                  disabled={loading}
                  label={loading ? "Signing in..." : "Sign in"}
                />
              </div>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              New here?{" "}
              <Link href="/sign-up" className="text-primary hover:underline font-medium">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
