import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
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
          Family-only access. New accounts are added by an admin.
        </p>
      </div>
    </div>
  );
}
