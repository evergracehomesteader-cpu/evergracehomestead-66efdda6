import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { APP_VERSION, APP_LAST_UPDATED, APP_PUBLISHED_URL } from "@/lib/app-version";

export const Route = createFileRoute("/_authenticated/app-updates")({ component: AppUpdatesPage });

const CHECKLIST = [
  "Test in Preview",
  "Publish",
  "Open live URL",
  "Confirm version number changed",
  "Confirm mobile home-screen app opens correctly",
];

const INSTALL_INSTRUCTIONS = `Install Homestead Hub on Android:

1. Open ${APP_PUBLISHED_URL} in Chrome on your Android phone.
2. Tap the three-dot menu (⋮) in the top-right.
3. Tap "Install app" (or "Add to Home screen").
4. Confirm by tapping "Install".
5. The app icon will appear on your home screen — tap to open in standalone mode.`;

function AppUpdatesPage() {
  const [checked, setChecked] = React.useState<boolean[]>(() => CHECKLIST.map(() => false));

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const lastUpdated = new Date(APP_LAST_UPDATED).toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold">App Updates</h1>
        <p className="text-muted-foreground">Maintenance helper for publishing new versions.</p>
      </div>

      <Card className="p-5 border-amber-500/40 bg-amber-500/5">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold mb-1">Publish Reminder</div>
            Preview changes are not live until you publish.
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Current build</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
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
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={() => copy(APP_PUBLISHED_URL, "Live URL")}>
            <Copy className="h-4 w-4" /> Copy live URL
          </Button>
          <Button size="sm" variant="outline" onClick={() => copy(INSTALL_INSTRUCTIONS, "Install instructions")}>
            <Copy className="h-4 w-4" /> Copy install instructions
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/changelog">View changelog</Link>
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-semibold">Post-change checklist</h2>
        <ul className="space-y-2">
          {CHECKLIST.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <Checkbox
                id={`chk-${i}`}
                checked={checked[i]}
                onCheckedChange={(v) =>
                  setChecked((prev) => prev.map((x, idx) => (idx === i ? v === true : x)))
                }
              />
              <label htmlFor={`chk-${i}`} className={`text-sm cursor-pointer ${checked[i] ? "line-through text-muted-foreground" : ""}`}>
                {i + 1}. {item}
              </label>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onClick={() => setChecked(CHECKLIST.map(() => false))}>
          Reset checklist
        </Button>
      </Card>
    </div>
  );
}
