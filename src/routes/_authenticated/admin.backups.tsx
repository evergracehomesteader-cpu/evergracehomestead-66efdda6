import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Database, Download, Trash2, Plus, AlertTriangle, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { createBackup, deleteBackup, getBackupDownloadUrl, getBackupManifest, restoreBackup } from "@/lib/backup.functions";

export const Route = createFileRoute("/_authenticated/admin/backups")({ component: BackupsPage });

type BackupRow = {
  id: string; label: string; notes: string | null; size_bytes: number;
  table_counts: Record<string, number>; storage_path: string;
  created_by: string | null; created_at: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function BackupsPage() {
  const qc = useQueryClient();
  const { isAdmin, loading } = usePermissions();
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const createFn = useServerFn(createBackup);
  const deleteFn = useServerFn(deleteBackup);
  const downloadFn = useServerFn(getBackupDownloadUrl);

  const { data: backups = [] } = useQuery({
    queryKey: ["backups"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("backups").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BackupRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => createFn({ data: { label: label.trim() || `Backup ${new Date().toLocaleString()}`, notes: notes.trim() || undefined } }),
    onSuccess: (r) => {
      toast.success(`Backup created (${formatBytes(r.size)})`);
      qc.invalidateQueries({ queryKey: ["backups"] });
      setCreating(false); setLabel(""); setNotes("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Backup deleted"); qc.invalidateQueries({ queryKey: ["backups"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const download = async (id: string) => {
    try {
      const { url, label } = await downloadFn({ data: { id } });
      // Trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.replace(/[^a-z0-9-_]/gi, "_")}.json`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold">Backup &amp; Restore</h1>
          <p className="text-muted-foreground">Manual backups of all homestead data.</p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Create backup</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create a new backup</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Before spring kidding" maxLength={120} /></div>
              <div><Label>Notes (optional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
              <p className="text-xs text-muted-foreground">This snapshots all animals, feed, finances, chores, and related records into a downloadable JSON file. Users and roles are not included.</p>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Backing up…" : "Create backup"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {backups.length === 0 ? (
        <Card className="p-12 text-center">
          <Database className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No backups yet. Create your first one above.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {backups.map((b) => {
              const totalRows = Object.values(b.table_counts ?? {}).reduce((s, n) => s + n, 0);
              return (
                <li key={b.id} className="px-4 py-3 flex items-start gap-3">
                  <Database className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{b.label}</div>
                    {b.notes && <div className="text-xs text-muted-foreground mt-0.5">{b.notes}</div>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{format(new Date(b.created_at), "MMM d, yyyy · h:mm a")}</Badge>
                      <Badge variant="outline" className="text-[10px]">{formatBytes(b.size_bytes)}</Badge>
                      <Badge variant="outline" className="text-[10px]">{totalRows.toLocaleString()} rows</Badge>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => download(b.id)}><Download className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setRestoreId(b.id)}><RotateCcw className="h-4 w-4" /></Button>
                  <ConfirmDelete
                    trigger={<Button size="sm" variant="ghost"><Trash2 className="h-4 w-4" /></Button>}
                    title={`Delete backup "${b.label}"?`}
                    onConfirm={() => del.mutate(b.id)}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {restoreId && <RestoreDialog backupId={restoreId} onClose={() => setRestoreId(null)} />}
    </div>
  );
}

function RestoreDialog({ backupId, onClose }: { backupId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const manifestFn = useServerFn(getBackupManifest);
  const restoreFn = useServerFn(restoreBackup);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState("");

  const { data: manifest, isLoading } = useQuery({
    queryKey: ["backup-manifest", backupId],
    queryFn: () => manifestFn({ data: { id: backupId } }),
  });

  const restore = useMutation({
    mutationFn: async () => restoreFn({ data: { id: backupId, tables: Array.from(selected), confirm: "RESTORE" } }),
    onSuccess: (r) => {
      const errors = Object.entries(r.results).filter(([, v]) => v.error);
      if (errors.length) toast.error(`Restore finished with errors: ${errors.map(([t]) => t).join(", ")}`);
      else toast.success("Restore completed");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = (t: string) => setSelected((s) => {
    const next = new Set(s); if (next.has(t)) next.delete(t); else next.add(t); return next;
  });

  const allTables = useMemo(() => manifest?.tables ?? [], [manifest]);
  const allSelected = allTables.length > 0 && selected.size === allTables.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Restore from backup: {manifest?.label}</DialogTitle></DialogHeader>
        {isLoading || !manifest ? (
          <p className="text-muted-foreground">Loading backup contents…</p>
        ) : (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>This will permanently overwrite data</AlertTitle>
              <AlertDescription>
                Selected tables will be erased and replaced with the backup's contents. This cannot be undone. Type <strong>RESTORE</strong> below to confirm.
              </AlertDescription>
            </Alert>

            <div>
              <Button size="sm" variant="outline" onClick={() => setSelected(allSelected ? new Set() : new Set(allTables))}>
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </div>

            <div className="border rounded max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr><th className="text-left p-2 w-8"></th><th className="text-left p-2">Table</th><th className="text-right p-2">In backup</th><th className="text-right p-2">Current</th></tr>
                </thead>
                <tbody>
                  {allTables.map((t) => (
                    <tr key={t} className="border-t">
                      <td className="p-2"><Checkbox checked={selected.has(t)} onCheckedChange={() => toggle(t)} /></td>
                      <td className="p-2 font-mono text-xs">{t}</td>
                      <td className="p-2 text-right">{manifest.backup_counts[t] ?? 0}</td>
                      <td className="p-2 text-right text-muted-foreground">{manifest.current_counts[t] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <Label>Type RESTORE to confirm</Label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESTORE" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={restore.isPending || confirm !== "RESTORE" || selected.size === 0}
            onClick={() => restore.mutate()}
          >
            {restore.isPending ? "Restoring…" : `Restore ${selected.size} table${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
