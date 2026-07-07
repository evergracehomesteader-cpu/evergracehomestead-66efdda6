import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sprout } from "lucide-react";

export const Route = createFileRoute("/accept-invite/$token")({ component: AcceptInvite });

function AcceptInvite() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Stash token so login can pick it up.
      sessionStorage.setItem("pending_invite_token", token);
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      setStatus("working");
      const c = supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
      const { data, error } = await c.rpc("accept_homestead_invitation", { _token: token });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      const hid = data as string;
      localStorage.setItem("current_homestead_id", hid);
      await supabase.from("user_current_homestead").upsert({ user_id: user.id, homestead_id: hid }, { onConflict: "user_id" });
      setStatus("done");
      toast.success("You've joined the homestead");
      setTimeout(() => navigate({ to: "/dashboard" }), 800);
    })();
  }, [user, loading, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <Card className="p-6 max-w-md w-full text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-3">
          <Sprout className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-display font-semibold mb-2">Homestead invitation</h1>
        {status === "working" && <p className="text-sm text-muted-foreground">Accepting invitation…</p>}
        {status === "done" && <p className="text-sm text-success">Welcome! Redirecting…</p>}
        {status === "error" && (
          <>
            <p className="text-sm text-destructive">{message}</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/dashboard" })}>Go to dashboard</Button>
          </>
        )}
        {status === "idle" && <p className="text-sm text-muted-foreground">Preparing…</p>}
      </Card>
    </div>
  );
}
