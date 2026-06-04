import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { Settings as SettingsIcon, LogOut, Info, ExternalLink, Users, Shield, Database, Wifi } from "lucide-react";
import { APP_VERSION, APP_LAST_UPDATED, APP_PUBLISHED_URL } from "@/lib/app-version";
import { BreedsManager } from "@/components/breeds/BreedsManager";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { isAdmin } = usePermissions();
  const lastUpdated = new Date(APP_LAST_UPDATED).toLocaleString();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Settings</h1>
        <p className="text-muted-foreground">Your Smileys app account.</p>
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

      <BreedsManager />

      {isAdmin && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-semibold">Administration</h2>
          </div>
          <p className="text-sm text-muted-foreground">Manage who can sign in and what they can do.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/admin/users"><Users className="h-4 w-4" /> Users</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/roles"><Shield className="h-4 w-4" /> Roles & permissions</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/backups"><Database className="h-4 w-4" /> Backups</Link></Button>
          </div>
        </Card>
      )}

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
          <Button size="sm" variant="outline" asChild><Link to="/pwa-diagnostics"><Wifi className="h-4 w-4 mr-1" /> PWA Diagnostics</Link></Button>
        </div>
      </Card>
    </div>
  );
}
