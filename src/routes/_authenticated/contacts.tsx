import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Phone, Mail, MapPin, UserRound, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/contacts")({ component: ContactsPage });

type Contact = { id: string; name: string; role: string; phone: string | null; email: string | null; location: string | null; notes: string | null };

const ROLES = ["vet", "feed_store", "breeder", "buyer", "farrier", "neighbor", "other"] as const;

type SbAny = {
  from: (t: string) => {
    select: (s: string) => { order: (col: string, o?: { ascending: boolean }) => Promise<{ data: Contact[] | null }> };
    insert: (r: unknown) => Promise<{ error: Error | null }>;
    update: (r: unknown) => { eq: (col: string, v: string) => Promise<{ error: Error | null }> };
    delete: () => { eq: (col: string, v: string) => Promise<{ error: Error | null }> };
  };
};

function ContactsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const sb = supabase as unknown as SbAny;

  const { data } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => (await sb.from("contacts").select("*").order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (p: Omit<Contact, "id"> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      if (p.id) {
        const { id, ...rest } = p;
        const { error } = await sb.from("contacts").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("contacts").insert({ ...p, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await sb.from("contacts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold">Contacts</h1>
          <p className="text-muted-foreground">Vets, breeders, buyers, neighbors.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="h-4 w-4" /> Add contact</Button></DialogTrigger>
          <ContactForm onSubmit={(p) => create.mutate(p)} submitting={create.isPending} />
        </Dialog>
      </div>

      {(data ?? []).length === 0 ? (
        <Card className="p-12 text-center">
          <UserRound className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No contacts yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{c.role.replace("_", " ")}</div>
                </div>
                <ConfirmDelete trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>} onConfirm={() => del.mutate(c.id)} />
              </div>
              <div className="mt-2 space-y-1 text-sm">
                {c.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /><a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a></div>}
                {c.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /><a href={`mailto:${c.email}`} className="hover:underline truncate">{c.email}</a></div>}
                {c.location && <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-muted-foreground" /><span className="truncate">{c.location}</span></div>}
                {c.notes && <p className="text-muted-foreground text-xs whitespace-pre-wrap">{c.notes}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactForm({ onSubmit, submitting }: { onSubmit: (p: Omit<Contact, "id">) => void; submitting: boolean }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("vet");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add contact</DialogTitle></DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("Name required"); return; }
          onSubmit({ name: name.trim(), role, phone: phone || null, email: email || null, location: location || null, notes: notes || null });
        }}
        className="space-y-3"
      >
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} /></div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} /></div>
        </div>
        <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} /></div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></div>
        <DialogFooter><Button type="submit" disabled={submitting}>Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
