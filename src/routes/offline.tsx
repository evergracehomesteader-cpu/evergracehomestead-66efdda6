import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { WifiOff } from "lucide-react";

export const Route = createFileRoute("/offline")({ component: OfflinePage });

function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-4">
      <div className="max-w-md text-center bg-card rounded-2xl shadow-lg p-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-display font-semibold mb-2">You're offline</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Smileys app can't reach the network right now. Cached pages still work — reconnect to sync changes.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
