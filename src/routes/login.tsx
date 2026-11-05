import { createFileRoute, useNavigate, Navigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  displayName: z.string().trim().min(1).max(80).optional(),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  const pendingInvite = typeof window !== "undefined" ? sessionStorage.getItem("pending_invite_token") : null;

  if (!loading && user) {
    if (pendingInvite) {
      sessionStorage.removeItem("pending_invite_token");
      return <Navigate to="/accept-invite/$token" params={{ token: pendingInvite }} />;
    }
    return <Navigate to="/dashboard" />;
  }

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, displayName: mode === "signup" ? displayName : undefined });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: parsed.data.displayName },
          },
        });
        if (error) throw error;
        toast.success("Account created — signing you in…");
        // If email confirmations are on, session may be null; try password sign-in.
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (signErr) {
          toast.info("Check your email to confirm your account.");
          setBusy(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
      if (pendingInvite) {
        navigate({ to: "/accept-invite/$token", params: { token: pendingInvite } });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Evergrace Homestead" className="mx-auto mb-4 w-72 max-w-full h-auto rounded-lg" />
          <h1 className="text-3xl font-display font-semibold">Homestead Hub</h1>
          <p className="text-muted-foreground text-sm mt-1">Livestock · Feed · Garden · Finances</p>
        </div>
        <Card className="p-6">
          <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={handleGoogle}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.58v2.97h3.88c2.27-2.09 3.57-5.17 3.57-8.74z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-2.97c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.07A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.29 14.32A7.2 7.2 0 0 1 4.91 12c0-.81.14-1.59.38-2.32V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.07z" />
              <path fill="#EA4335" d="M12 4.73c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.07C6.23 6.84 8.88 4.73 12 4.73z" />
            </svg>
            Continue with Google
          </Button>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-2 text-xs uppercase text-muted-foreground">or</span></div>
          </div>
          <div className="flex gap-1 mb-4 rounded-md bg-muted p-1">
            <button type="button" onClick={() => setMode("signin")}
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${mode === "signin" ? "bg-background shadow" : "text-muted-foreground"}`}>
              Sign in
            </button>
            <button type="button" onClick={() => setMode("signup")}
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${mode === "signup" ? "bg-background shadow" : "text-muted-foreground"}`}>
              Create account
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Your name</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-2 text-xs uppercase text-muted-foreground">or</span></div>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={async () => { const { enterDemoMode } = await import("@/lib/demo/mode"); await enterDemoMode(); }}>
            Try Demo Mode
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Explore with realistic sample data. Nothing is saved to your account.
          </p>
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-6">
          {mode === "signup"
            ? "By creating an account, you get your own private homestead."
            : "New here? Create an account to start your own homestead."}
        </p>
        <p className="text-xs text-muted-foreground text-center mt-3">
          <Link to="/privacy" className="underline">Privacy Policy</Link>
          {" · "}
          <Link to="/terms" className="underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
