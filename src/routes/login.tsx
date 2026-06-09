import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { previewSignIn } from "@/lib/preview-auth.functions";

export const Route = createFileRoute("/login")({ component: LoginPage });

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  if (!h.endsWith(".lovable.app")) return false;
  return h.includes("preview") || h.endsWith("-dev.lovable.app");
}

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const callPreviewSignIn = useServerFn(previewSignIn);

  // Auto sign-in as the read-only Demo User on Lovable preview hosts.
  useEffect(() => {
    if (loading || user || !isPreviewHost()) return;
    let cancelled = false;
    (async () => {
      setPreviewBusy(true);
      try {
        const { access_token, refresh_token } = await callPreviewSignIn();
        if (cancelled) return;
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Preview sign-in failed");
        }
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, callPreviewSignIn, navigate]);

  if (!loading && user) return <Navigate to="/dashboard" />;

  const signIn = async (creds: { email: string; password: string }) => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(creds);
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    await signIn(parsed.data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Sprout className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-semibold">Homestead Hub</h1>
          <p className="text-muted-foreground text-sm mt-1">Livestock · Feed · Garden · Finances</p>
        </div>
        <Card className="p-6">
          {previewBusy ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              Signing you in as Preview User…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Please wait…" : "Sign in"}
              </Button>
            </form>
          )}
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-6">
          Family-only access. New accounts are added by an admin.
        </p>
      </div>
    </div>
  );
}


