"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";
import { Eye, EyeOff } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function BenchLogo() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-8">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="2.7" fill="currentColor" />
          <circle cx="17.5" cy="6.5" r="2.7" fill="currentColor" />
          <circle cx="12" cy="17.5" r="2.7" fill="currentColor" />
          <path d="M8.5 8.2L10.5 12.2M15.5 8.2L13.5 12.2M9.8 15.4H14.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-xl font-semibold tracking-tight">Bench</span>
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const initialEmail = searchParams.get("email") ?? "";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotHint, setForgotHint] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setForgotHint(null);
  }, [mode]);

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const res = await api.auth.register({
          email,
          password,
          display_name: displayName || null,
        });
        setAuthToken(res.token);
      } else {
        const res = await api.auth.login({ email, password });
        setAuthToken(res.token);
      }
      router.replace(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-background relative flex items-center justify-center px-4 py-12 sm:px-6 overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--foreground) 5%, transparent) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      {/* radial glow behind card */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--primary) 8%, transparent), transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md animate-slide-up-fade">
        <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur-sm p-8 shadow-[0_4px_6px_rgba(0,0,0,0.04),0_24px_60px_rgba(0,0,0,0.10)]">
          <BenchLogo />

          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight">
              {mode === "login" ? "Sign in to Bench" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login" ? "Enter your email and password." : "Get started — it only takes a moment."}
            </p>
          </div>

          {error && (
            <div
              className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  Display name <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setForgotHint("Password reset isn't available in this environment yet.")}
                  >
                    Forgot password
                  </button>
                )}
              </div>

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-11"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {forgotHint && <p className="text-xs text-muted-foreground">{forgotHint}</p>}
            </div>

            <Button
              className="w-full"
              type="submit"
              disabled={loading || !email.trim() || !password}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground border-t border-border/60 pt-5">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
