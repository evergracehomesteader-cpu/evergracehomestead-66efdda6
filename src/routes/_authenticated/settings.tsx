import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Settings as SettingsIcon, LogOut, Info, ExternalLink } from "lucide-react";
import { APP_VERSION, APP_LAST_UPDATED, APP_PUBLISHED_URL } from "@/lib/app-version";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const lastUpdated = new Date(APP_LAST_UPDATED).toLocaleString();
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

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">About</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your homestead operating system — animals, breeding, feed, bills, and harvest all in one place.
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-2">
          <div><dt className="text-muted-foreground">Version</dt><dd className="font-medium">v{APP_VERSION}</dd></div>
          <div><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{lastUpdated}</dd></div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Published URL</dt>
            <dd className="font-medium truncate">
              <a href={APP_PUBLISHED_URL} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                {APP_PUBLISHED_URL} <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
          </div>
        </dl>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" asChild><Link to="/changelog">Changelog</Link></Button>
          <Button size="sm" variant="outline" asChild><Link to="/app-updates">App Updates</Link></Button>
        </div>
      </Card>
    </div>
  );
}
