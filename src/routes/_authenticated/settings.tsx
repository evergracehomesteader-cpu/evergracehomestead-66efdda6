import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Settings as SettingsIcon, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Settings</h1>
        <p className="text-muted-foreground">Your EverGrace Homestead account.</p>
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="text-sm">
          <div className="text-muted-foreground">Signed in as</div>
          <div className="font-medium">{user?.email ?? "—"}</div>
        </div>
        <Button variant="outline" onClick={() => signOut()}><LogOut className="h-4 w-4" /> Sign out</Button>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold mb-2">About EverGrace Homestead</h2>
        <p className="text-sm text-muted-foreground">
          Your homestead operating system — animals, breeding, feed, bills, and harvest all in one place.
        </p>
      </Card>
    </div>
  );
}
