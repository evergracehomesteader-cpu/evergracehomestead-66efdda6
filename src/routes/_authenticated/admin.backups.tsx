import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { Database, DownloadCloud, RotateCcw, Trash2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { listBackups, createBackup, deleteBackup, restoreBackup, BACKUP_TABLES } from "@/lib/backups.functions";

export const Route = createFileRoute("/_authenticated/admin/backups")({ component: BackupsPage });

type BackupRow = {
  id: string; label: string; created_at: string; size_bytes: number;
  table_counts: Record<string, number>; notes: string | null; storage_path: string;
};

function BackupsPage() {
  const { isAdmin, loading } = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listBackups);
  const create = useServerFn(createBackup);
  const del = useServerFn(deleteBackup);
  const restore = useServerFn(restoreBackup);
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreFor, setRestoreFor] = useState<BackupRow | null>(null);

  const backupsQ = useQuery({
    queryKey: ["admin-backups"],
    enabled: isAdmin,
    queryFn: () => list() as Promise<BackupRow[]>,
  });

  const createM = useMutation({
    mutationFn: (data: { label: string; notes?: string }) => create({ data }),
    onSuccess: () => { toast.success("Backup created"); qc.invalidateQueries({ queryKey: ["admin-backups"] }); setCreateOpen(false); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-backups"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const restoreM = useMutation({
    mutationFn: (p: { id: string; tables: string[]; mode: "replace" | "merge" }) => restore({ data: p }),
    onSuccess: (res) => {
      const total = Object.values((res as { results: Record<string, { restored: number }> }).results)
        .reduce((s, r) => s + r.restored, 0);
      toast.success(`Restored ${total} rows`);
      setRestoreFor(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <Button className="mt-3" variant="outline" onClick={() => navigate({ to: "/settings" })}>Back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-semibold">Backups</h1>
          <p className="text-muted-foreground">Snapshot your data and restore selected tables.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><DownloadCloud className="h-4 w-4" /> Create backup</Button></DialogTrigger>
          <CreateBackupForm submitting={createM.isPending} onSubmit={(d) => createM.mutate(d)} />
        </Dialog>
      </div>

      {(backupsQ.data ?? []).length === 0 ? (
        <Card className="p-10 text-center">
          <Database className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No backups yet. Click "Create backup" to make your first snapshot.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {(backupsQ.data ?? []).map((b) => {
              const total = Object.values(b.table_counts ?? {}).reduce((s, n) => s + n, 0);
              const tablesWithRows = Object.keys(b.table_counts ?? {}).filter((t) => b.table_counts[t] > 0).length;
              return (
                <li key={b.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{b.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(b.created_at), "MMM d, yyyy · h:mm a")}
                      {" · "}{(b.size_bytes / 1024).toFixed(1)} KB
                      {" · "}{total} rows across {tablesWithRows} tables
                    </div>
                    {b.notes && <div className="text-xs text-muted-foreground mt-0.5">{b.notes}</div>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setRestoreFor(b)}>
                    <RotateCcw className="h-4 w-4" /> Restore
                  </Button>
                  <ConfirmDelete
                    trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>}
                    title={`Delete backup "${b.label}"?`}
                    onConfirm={() => delM.mutate(b.id)}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {restoreFor && (
        <RestoreDialog
          backup={restoreFor}
          submitting={restoreM.isPending}
          onClose={() => setRestoreFor(null)}
          onSubmit={(tables, mode) => restoreM.mutate({ id: restoreFor.id, tables, mode })}
        />
      )}
    </div>
  );
}

function CreateBackupForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (d: { label: string; notes?: string }) => void }) {
  const [label, setLabel] = useState(`Backup ${format(new Date(), "yyyy-MM-dd")}`);
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Create backup</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; onSubmit({ label: label.trim(), notes: notes || undefined }); }}>
        <div><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={120} /></div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
        <p className="text-xs text-muted-foreground">
          Snapshots all homestead tables (animals, feed, finances, chores, etc.). Auth, roles, and storage are not included.
        </p>
        <DialogFooter><Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function RestoreDialog({
  backup, submitting, onClose, onSubmit,
}: {
  backup: BackupRow; submitting: boolean; onClose: () => void;
  onSubmit: (tables: string[], mode: "replace" | "merge") => void;
}) {
  const available = (BACKUP_TABLES as readonly string[]).filter((t) => (backup.table_counts?.[t] ?? 0) > 0);
  const [selected, setSelected] = useState<string[]>(available);
  const [mode, setMode] = useState<"replace" | "merge">("merge");

  const toggle = (t: string) => setSelected((cur) => cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Restore from "{backup.label}"</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Restore mode</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "replace" | "merge")} className="mt-1">
              <label className="flex items-start gap-2 p-2 rounded border cursor-pointer">
                <RadioGroupItem value="merge" id="m-merge" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Merge</div>
                  <div className="text-xs text-muted-foreground">Insert or update rows by ID. Existing rows not in the backup are kept.</div>
                </div>
              </label>
              <label className="flex items-start gap-2 p-2 rounded border cursor-pointer">
                <RadioGroupItem value="replace" id="m-replace" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-destructive">Replace</div>
                  <div className="text-xs text-muted-foreground">DELETE all rows in the selected tables, then load from the backup.</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Tables to restore</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setSelected(available)}>All</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setSelected([])}>None</Button>
              </div>
            </div>
            <div className="border rounded-md p-2 max-h-72 overflow-y-auto mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {available.map((t) => (
                <label key={t} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={selected.includes(t)} onCheckedChange={() => toggle(t)} />
                  <span className="text-sm flex-1">{t}</span>
                  <Badge variant="outline" className="text-[10px]">{backup.table_counts[t]}</Badge>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{selected.length} of {available.length} tables selected</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            disabled={submitting || selected.length === 0}
            variant={mode === "replace" ? "destructive" : "default"}
            onClick={() => onSubmit(selected, mode)}
          >
            {submitting ? "Restoring…" : mode === "replace" ? "Replace & restore" : "Merge restore"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
