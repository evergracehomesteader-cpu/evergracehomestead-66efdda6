import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

/** Blocks a page unless the signed-in member has the given permission. */
export function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { can, loading } = usePermissions();

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!can(perm)) {
    return (
      <Card className="p-6 space-y-3 max-w-lg">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-display text-xl font-semibold">Not available</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your role on this homestead doesn’t include access to this section. Ask the owner if you
          need it.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </Card>
    );
  }

  return <>{children}</>;
}
