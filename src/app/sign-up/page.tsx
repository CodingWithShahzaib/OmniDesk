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

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: err } = await authClient.signUp.email({
      email,
      password,
      name: name.trim() || email.split("@")[0],
      callbackURL: "/timesheet",
    });
    setLoading(false);
    if (err) {
      setError(err.message || "Sign up failed");
      return;
    }
    if (data) router.push("/timesheet");
  };

  return (
    <div className="relative min-h-screen grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -right-28 -top-24 h-72 w-72 rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-accent/22 blur-3xl" />
      </div>

      {/* Left visual panel (hidden on mobile) */}
      <div className="relative hidden md:flex flex-col justify-between bg-gradient-to-br from-primary/16 via-accent/12 to-transparent px-12 py-14">
        <div className="space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/60 dark:bg-white/10 px-4 py-2 text-xs text-muted-foreground ring-1 ring-white/50 backdrop-blur">
            <span>Get started</span>
            <span className="font-semibold text-foreground">OmniDesk</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              Create your workspace
            </h1>
            <p className="text-muted-foreground">
              Build a calm, glassy dashboard for daily task tracking and exportable timesheets.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Clean typography and blurred surfaces for focus.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Light/dark themes with consistent elevations.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Export-ready timesheet workflows out of the box.
              </li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Your preferences stay in sync across sessions.
        </p>
      </div>

      {/* Right auth panel */}
      <div className="relative flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)]">
          <CardHeader>
            <CardTitle className="text-2xl">Create your account</CardTitle>
            <CardDescription>Start tracking tasks and timesheets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Shahzaib Rehman"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/80 dark:bg-white/5 backdrop-blur"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  required
                  minLength={8}
                  className="bg-white/80 dark:bg-white/5 backdrop-blur"
                />
                <p className="text-xs text-muted-foreground">
                  Use 8+ characters with a mix of letters and numbers.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-center pt-1">
                <LiquidMetalButton
                  type="submit"
                  disabled={loading}
                  label={loading ? "Creating account..." : "Sign up"}
                />
              </div>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
