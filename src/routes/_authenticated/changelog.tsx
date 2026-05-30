import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { CHANGELOG, APP_VERSION } from "@/lib/app-version";

export const Route = createFileRoute("/_authenticated/changelog")({ component: ChangelogPage });

function ChangelogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">Changelog</h1>
        <p className="text-muted-foreground">Current version: v{APP_VERSION}</p>
      </div>
      <div className="space-y-4">
        {CHANGELOG.map((entry) => (
          <Card key={entry.version} className="p-5">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h2 className="font-semibold">v{entry.version}</h2>
              <span className="text-xs text-muted-foreground">{entry.date}</span>
            </div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {entry.changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </Card>
        ))}
      </div>
      <Link to="/app-updates" className="text-sm text-primary underline">Back to App Updates</Link>
    </div>
  );
}
