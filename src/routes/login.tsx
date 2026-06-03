import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Sprout } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);


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

  const handlePreviewLogin = () => {
    if (!previewEnabled) return;
    void signIn({ email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Sprout className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-display font-semibold">Smileys app</h1>
          <p className="text-muted-foreground text-sm mt-1">Livestock · Feed · Garden · Finances</p>
        </div>
        <Card className="p-6">
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

          {previewEnabled && (
            <div className="mt-6 pt-6 border-t">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">
                Preview / dev only
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={handlePreviewLogin}
              >
                Sign in as preview tester
              </Button>
              <p className="text-[11px] text-muted-foreground mt-2">
                Test account — not visible on the published site.
              </p>
            </div>
          )}
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-6">
          Family-only access. New accounts are added by an admin.
        </p>
      </div>
    </div>
  );
}

