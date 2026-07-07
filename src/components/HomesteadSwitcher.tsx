import { useState } from "react";
import { useHomestead } from "@/lib/homestead-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Home, Check, Plus, Settings2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { isDemoMode } from "@/lib/demo/mode";

export function HomesteadSwitcher() {
  const { user } = useAuth();
  const { memberships, currentId, currentName, setCurrent, refresh } = useHomestead();
  const [openNew, setOpenNew] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const demo = isDemoMode();

  if (demo) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs bg-card">
        <Home className="h-3.5 w-3.5" />
        <span className="font-medium truncate">Demo Homestead</span>
      </div>
    );
  }

  const create = async () => {
    if (!name.trim() || !user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("homesteads")
        .insert({ name: name.trim(), owner_id: user.id })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("homestead_members").insert({
        homestead_id: data.id,
        user_id: user.id,
        role: "admin",
      });
      refresh();
      await setCurrent(data.id);
      setName("");
      setOpenNew(false);
      toast.success("Homestead created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 max-w-[240px]">
            <Home className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{currentName || "Choose homestead"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {memberships.map((m) => (
            <DropdownMenuItem key={m.homestead_id} onClick={() => setCurrent(m.homestead_id)}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="truncate flex-1">{m.homesteads?.name ?? "Homestead"}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
                {currentId === m.homestead_id && <Check className="h-3.5 w-3.5 text-primary" />}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenNew(true)}>
            <Plus className="h-3.5 w-3.5" /> Create homestead
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/homestead"><Settings2 className="h-3.5 w-3.5" /> Homestead settings</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New homestead</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Willow Creek Farm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy || !name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
