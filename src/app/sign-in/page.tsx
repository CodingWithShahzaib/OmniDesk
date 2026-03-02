"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-background">
      {/* Left visual panel (hidden on mobile) */}
      <div className="relative hidden md:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,hsl(var(--primary)/0.15),transparent_60%)] dark:bg-[radial-gradient(60%_60%_at_50%_40%,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-accent/40 to-background" />
        <div className="relative z-10 h-full flex flex-col justify-between p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-card/60 px-3 py-1 text-xs text-muted-foreground ring-1 ring-border backdrop-blur">
              <span>Welcome to</span>
              <span className="font-semibold text-foreground">OmniDesk</span>
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight">
              Your daily productivity hub
            </h1>
            <p className="mt-3 text-muted-foreground max-w-md">
              Track tasks, share updates, and export monthly timesheets with ease.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Pro tip: Toggle dark mode from the dashboard sidebar after sign-in.
          </p>
        </div>
      </div>

      {/* Right auth panel */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Access your OmniDesk workspace</CardDescription>
          </CardHeader>
          <CardContent>
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
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
