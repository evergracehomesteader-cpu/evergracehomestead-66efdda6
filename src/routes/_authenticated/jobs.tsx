import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useHomestead } from "@/lib/homestead-context";
import { usePermissions } from "@/hooks/usePermissions";
import { isDemoMode } from "@/lib/demo/mode";
import { RequirePermission } from "@/components/RequirePermission";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Copy, Mail, MessageSquare, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { parseDateOnly } from "@/lib/dates";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/jobs")({
  component: () => (
    <RequirePermission perm="jobs.view">
      <JobsPage />
    </RequirePermission>
  ),
});

interface MaterialsLine {
  key: string;
  label: string;
  qty: number;
  price: number;
}

interface Job {
  id: string;
  homestead_id: string;
  created_by: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  job_title: string | null;
  status: string;
  scheduled_date: string | null;
  sqft: number | null;
  hang: boolean;
  finish: boolean;
  hang_labor_rate: number;
  finish_labor_rate: number;
  materials_cost: number;
  materials_items: MaterialsLine[] | null;
  labor_hours: number | null;
  labor_hourly_rate: number | null;
  helper_rate: number | null;
  helper_hours: number | null;
  crew_size: number;
  total: number;
  deposit: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type JobPayload = Omit<Job, "id" | "homestead_id" | "created_by" | "created_at" | "updated_at">;

// The generated Supabase types don't know the jobs table yet (same pattern as
// role_permissions in usePermissions.ts), so go through a narrow local cast.
type JobsSb = {
  from: (t: string) => {
    select: (s: string) => {
      eq: (c: string, v: string) => {
        order: (c: string, o?: { ascending: boolean; nullsFirst?: boolean }) => {
          order: (c: string, o?: { ascending: boolean }) => Promise<{ data: Job[] | null; error: Error | null }>;
        };
      };
    };
    insert: (r: unknown) => Promise<{ error: Error | null }>;
    update: (r: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
    delete: () => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
  };
};
const sb = supabase as unknown as JobsSb;

const STATUSES = [
  { value: "new", label: "New" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "Working" },
  { value: "done", label: "Done" },
  { value: "paid", label: "Paid" },
] as const;

const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: string) => {
  if (!v.trim()) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---- Materials estimate ---------------------------------------------------
// Quantities are a starting guess from the square footage (with 10% waste on
// sheets); every qty and price stays editable. Once Aaron types a qty
// himself we stop overwriting it (the "touched" set in the form). Prices are
// his to set — the form links out to Lowe's / Menards / Home Depot so he can
// check today's price.
const MATERIAL_DEFS: {
  key: string;
  label: string;
  price: number;
  autoQty: (sqft: number, hang: boolean, finish: boolean) => number;
}[] = [
  { key: "sheets", label: "Sheets 4×8", price: 14, autoQty: (s) => Math.ceil((s * 1.1) / 32) },
  { key: "mud", label: "Mud buckets (4.5 gal)", price: 18, autoQty: (s, _h, f) => (f ? Math.ceil(s / 400) : 0) },
  { key: "tape", label: "Tape rolls (500 ft)", price: 6, autoQty: (s, _h, f) => (f ? Math.ceil(s / 500) : 0) },
  { key: "screws", label: "Screws (lbs)", price: 8, autoQty: (s, h) => (h ? Math.ceil(s / 225) : 0) },
  { key: "bead", label: "Corner bead sticks (8 ft)", price: 4, autoQty: () => 0 },
];

function initialMaterials(saved?: MaterialsLine[] | null): MaterialsLine[] {
  return MATERIAL_DEFS.map((d) => {
    const s = saved?.find((l) => l.key === d.key);
    return s ? { ...s } : { key: d.key, label: d.label, qty: 0, price: d.price };
  });
}

function JobsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentId } = useHomestead();
  const { can } = usePermissions();
  const demo = isDemoMode();
  const [view, setView] = useState<"list" | "new" | Job>("list");

  const jobsQ = useQuery({
    queryKey: ["jobs", currentId],
    enabled: !!currentId && !demo,
    queryFn: async () => {
      const { data, error } = await sb
        .from("jobs")
        .select("*")
        .eq("homestead_id", currentId!)
        .order("scheduled_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });

  const save = useMutation({
    mutationFn: async ({ payload, id }: { payload: JobPayload; id?: string }) => {
      if (id) {
        const { error } = await sb
          .from("jobs")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from("jobs")
          .insert({ ...payload, homestead_id: currentId!, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs", currentId] });
      setView("list");
      toast.success("Job saved");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs", currentId] });
      setView("list");
      toast.success("Job deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (demo) {
    return <div className="text-muted-foreground">Jobs are not available in Demo Mode.</div>;
  }
  if (!currentId) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  if (view !== "list") {
    const editing = view === "new" ? undefined : view;
    return (
      <JobForm
        initial={editing}
        canSave={editing ? can("jobs.edit") : can("jobs.create")}
        saving={save.isPending}
        onBack={() => setView("list")}
        onSave={(payload) => save.mutate({ payload, id: editing?.id })}
        onDelete={
          editing && can("jobs.edit") ? () => del.mutate(editing.id) : undefined
        }
      />
    );
  }

  const jobs = jobsQ.data ?? [];

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h1 className="text-3xl font-display font-semibold">Jobs</h1>
        <p className="text-muted-foreground">Drywall jobs &amp; estimates.</p>
      </div>

      {can("jobs.create") && (
        <Button size="lg" className="w-full h-14 text-lg" onClick={() => setView("new")}>
          + Add a Job
        </Button>
      )}

      {jobsQ.isLoading && <p className="text-muted-foreground">Loading jobs…</p>}
      {jobsQ.isError && (
        <p className="text-destructive">Couldn't load jobs: {(jobsQ.error as Error)?.message}</p>
      )}
      {jobsQ.isSuccess && jobs.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-lg text-muted-foreground">No jobs yet.</p>
          <p className="text-muted-foreground">Tap “+ Add a Job” to put the first one in.</p>
        </Card>
      )}

      <div className="space-y-3">
        {jobs.map((j) => {
          const owed = Number(j.total) - Number(j.amount_paid);
          return (
            <Card key={j.id} className="p-4 cursor-pointer" onClick={() => setView(j)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xl font-semibold truncate">{j.customer_name}</div>
                  {(j.job_title || j.address) && (
                    <div className="text-base text-muted-foreground truncate">
                      {j.job_title ?? j.address}
                    </div>
                  )}
                  {j.scheduled_date && (
                    <div className="text-sm text-muted-foreground">
                      {format(parseDateOnly(j.scheduled_date), "EEE, MMM d, yyyy")}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="text-xl font-bold">{money(Number(j.total))}</div>
                  <Badge>{statusLabel(j.status)}</Badge>
                </div>
              </div>
              {owed > 0 && (
                <div className="mt-2 text-base font-semibold text-destructive">
                  Owes {money(owed)}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function JobForm({
  initial,
  canSave,
  saving,
  onBack,
  onSave,
  onDelete,
}: {
  initial?: Job;
  canSave: boolean;
  saving: boolean;
  onBack: () => void;
  onSave: (payload: JobPayload) => void;
  onDelete?: () => void;
}) {
  const [customerName, setCustomerName] = useState(initial?.customer_name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.job_title ?? "");
  const [status, setStatus] = useState(initial?.status ?? "new");
  const [date, setDate] = useState(initial?.scheduled_date ?? "");
  const [sqft, setSqft] = useState(initial?.sqft?.toString() ?? "");
  const [hang, setHang] = useState(initial?.hang ?? true);
  const [hangRate, setHangRate] = useState(initial?.hang_labor_rate?.toString() ?? "0.75");
  const [finish, setFinish] = useState(initial?.finish ?? true);
  const [finishRate, setFinishRate] = useState(initial?.finish_labor_rate?.toString() ?? "1.25");
  const [matLines, setMatLines] = useState<MaterialsLine[]>(() => initialMaterials(initial?.materials_items));
  // On an existing job every line starts "touched" — saved quantities win
  // over the square-footage guesses. On a new job nothing is touched, so
  // quantities follow the square footage until Aaron types over one.
  const [matTouched, setMatTouched] = useState<ReadonlySet<string>>(
    () => new Set(initial ? MATERIAL_DEFS.map((d) => d.key) : []),
  );
  // Anything in materials_cost that the lines don't explain (an old job's
  // hand-typed materials $, or a previous "other") lands in Other materials.
  const [extraMaterials, setExtraMaterials] = useState(() => {
    if (!initial) return "";
    const linesTotal = (initial.materials_items ?? []).reduce((sum, l) => sum + l.qty * l.price, 0);
    const extra = initial.materials_cost - linesTotal;
    return extra > 0 ? String(round1(extra)) : "";
  });
  const [crewSize, setCrewSize] = useState(initial?.crew_size ?? 1);
  const [helperRate, setHelperRate] = useState(initial?.helper_rate?.toString() ?? "16");
  const [helperHours, setHelperHours] = useState(initial?.helper_hours?.toString() ?? "");
  const [helperHoursTouched, setHelperHoursTouched] = useState(initial?.helper_hours != null);
  const [hours, setHours] = useState(initial?.labor_hours?.toString() ?? "");
  const [hourlyRate, setHourlyRate] = useState(initial?.labor_hourly_rate?.toString() ?? "");
  const [deposit, setDeposit] = useState(initial?.deposit?.toString() ?? "");
  const [paid, setPaid] = useState(initial?.amount_paid?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const sqftN = num(sqft);
  const linesTotal = matLines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const materialsTotal = linesTotal + num(extraMaterials);

  const total =
    sqftN * (hang ? num(hangRate) : 0) +
    sqftN * (finish ? num(finishRate) : 0) +
    materialsTotal +
    num(hours) * num(hourlyRate);
  const owed = total - num(paid);

  // ---- Time & crew estimate -------------------------------------------------
  // Rough trade pace: ~55 sq ft/hr to hang, ~45 sq ft/hr to finish (spread
  // over the repeat trips finishing needs). A "day" is 8 working hours.
  const hangHours = hang ? sqftN / 55 : 0;
  const finishHours = finish ? sqftN / 45 : 0;
  const totalHours = hangHours + finishHours;
  const totalHoursR = round1(totalHours);
  const workDays =
    totalHours > 0 ? Math.max(0.5, Math.ceil((totalHours / (8 * crewSize)) * 2) / 2) : 0;

  // Helper pay comes out of Aaron's pocket, NOT the customer's bill — it
  // only feeds the "Aaron keeps about" breakdown below the total.
  const helperCost = crewSize === 2 ? num(helperRate) * num(helperHours) : 0;
  const aaronKeeps = total - materialsTotal - helperCost;

  const updateLine = (key: string, patch: Partial<MaterialsLine>) =>
    setMatLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Auto-fill material quantities from the square footage until Aaron
  // overrides a line himself.
  useEffect(() => {
    setMatLines((prev) =>
      prev.map((l) => {
        if (matTouched.has(l.key)) return l;
        const def = MATERIAL_DEFS.find((d) => d.key === l.key);
        return def ? { ...l, qty: def.autoQty(sqftN, hang, finish) } : l;
      }),
    );
  }, [sqftN, hang, finish, matTouched]);

  // Helper hours follow the job's total hours until Aaron edits them.
  useEffect(() => {
    if (!helperHoursTouched) {
      setHelperHours(totalHours > 0 ? String(totalHoursR) : "");
    }
  }, [totalHours, totalHoursR, helperHoursTouched]);

  const submit = () => {
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    onSave({
      customer_name: customerName.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      job_title: jobTitle.trim() || null,
      status,
      scheduled_date: date || null,
      sqft: numOrNull(sqft),
      hang,
      finish,
      hang_labor_rate: num(hangRate),
      finish_labor_rate: num(finishRate),
      materials_cost: materialsTotal,
      materials_items: matLines,
      labor_hours: numOrNull(hours),
      labor_hourly_rate: numOrNull(hourlyRate),
      helper_rate: crewSize === 2 ? numOrNull(helperRate) : null,
      helper_hours: crewSize === 2 ? numOrNull(helperHours) : null,
      crew_size: crewSize,
      total,
      deposit: num(deposit),
      amount_paid: num(paid),
      notes: notes.trim() || null,
    });
  };

  // ---- Invoice sending -------------------------------------------------
  // No mail/SMS provider is wired into the app, so sending goes through the
  // phone's own Mail / Messages apps with the invoice pre-filled — it comes
  // from Aaron's own email address / phone number, which customers know.
  const invoiceSubject = `Invoice — ${jobTitle.trim() || "Drywall work"}`;
  const buildInvoice = () => {
    const lines: string[] = [
      `INVOICE — ${jobTitle.trim() || "Drywall work"}`,
      `For: ${customerName.trim() || "Customer"}`,
    ];
    if (address.trim()) lines.push(`At: ${address.trim()}`);
    if (date) lines.push(`Date: ${date}`);
    lines.push("");
    if (hang) lines.push(`Hanging: ${num(sqft)} sq ft × ${money(num(hangRate))} = ${money(num(sqft) * num(hangRate))}`);
    if (finish) lines.push(`Finishing: ${num(sqft)} sq ft × ${money(num(finishRate))} = ${money(num(sqft) * num(finishRate))}`);
    if (num(hours) > 0) lines.push(`Labor: ${num(hours)} hrs × ${money(num(hourlyRate))} = ${money(num(hours) * num(hourlyRate))}`);
    if (materialsTotal > 0) {
      lines.push(`Materials: ${money(materialsTotal)}`);
      for (const l of matLines) {
        if (l.qty > 0) lines.push(`  ${l.qty} × ${l.label} @ ${money(l.price)} = ${money(l.qty * l.price)}`);
      }
      if (num(extraMaterials) > 0) lines.push(`  Other materials: ${money(num(extraMaterials))}`);
    }
    if (totalHours > 0) {
      lines.push(
        `Estimated time: about ${workDays} ${workDays === 1 ? "day" : "days"} of work` +
          (finish ? " (finishing takes 3 trips — coats dry between visits)" : ""),
      );
    }
    lines.push("", `TOTAL: ${money(total)}`);
    if (num(paid) > 0) lines.push(`Paid: ${money(num(paid))}`);
    if (owed > 0) lines.push(`BALANCE DUE: ${money(owed)}`);
    else if (num(paid) > 0) lines.push("Paid in full — thank you!");
    lines.push("", "Thank you for your business!");
    return lines.join("\n");
  };

  const openLink = (href: string) => {
    const a = document.createElement("a");
    a.href = href;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const sendInvoiceEmail = () => {
    if (!email.trim()) {
      toast.error("Add the customer's email first");
      return false;
    }
    openLink(`mailto:${email.trim()}?subject=${encodeURIComponent(invoiceSubject)}&body=${encodeURIComponent(buildInvoice())}`);
    return true;
  };

  const sendInvoiceText = () => {
    if (!phone.trim()) {
      toast.error("Add the customer's phone first");
      return false;
    }
    openLink(`sms:${phone.trim()}?&body=${encodeURIComponent(buildInvoice())}`);
    return true;
  };

  const sendInvoiceBoth = () => {
    if (!email.trim() || !phone.trim()) {
      toast.error("For Both, the customer needs an email AND a phone");
      return;
    }
    if (sendInvoiceEmail()) {
      toast.success("Email opened — sending the text in a moment…");
      setTimeout(() => sendInvoiceText(), 900);
    }
  };

  const copyInvoice = async () => {
    try {
      await navigator.clipboard.writeText(buildInvoice());
      toast.success("Invoice copied — paste it anywhere");
    } catch {
      toast.error("Couldn't copy on this phone");
    }
  };

  const bigInput = "h-12 text-lg";

  return (
    <div className="space-y-4 pb-20">
      <Button variant="ghost" size="lg" className="text-lg -ml-2" onClick={onBack}>
        <ArrowLeft className="h-5 w-5" /> Back to jobs
      </Button>
      <h1 className="text-3xl font-display font-semibold">{initial ? "Job" : "New Job"}</h1>
      {!canSave && (
        <p className="text-muted-foreground">You can look at this job, but not change it.</p>
      )}

      <fieldset disabled={!canSave} className="space-y-4">
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-customer">Customer name *</Label>
            <Input id="job-customer" className={bigInput} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Smith" />
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-phone">Phone</Label>
            <Input id="job-phone" className={bigInput} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-email">Email</Label>
            <Input id="job-email" className={bigInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-address">Address</Label>
            <Input id="job-address" className={bigInput} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-title">Job name</Label>
            <Input id="job-title" className={bigInput} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Kitchen remodel" />
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-date">Date</Label>
            <Input id="job-date" className={bigInput} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Status</Label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Button
                  key={s.value}
                  type="button"
                  size="lg"
                  className="h-12 px-4 text-base"
                  variant={status === s.value ? "default" : "outline"}
                  onClick={() => setStatus(s.value)}
                >
                  {status === s.value && <Check className="h-4 w-4" />}
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h2 className="text-xl font-semibold">Estimate</h2>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-sqft">Square feet</Label>
            <Input id="job-sqft" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" min="0" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="0" />
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button type="button" size="lg" variant={hang ? "default" : "outline"} className="h-14 flex-1 text-lg" onClick={() => setHang(!hang)}>
                {hang && <Check className="h-5 w-5" />} Hanging
              </Button>
              <div className="w-32">
                <Input aria-label="Hanging rate per square foot" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" step="0.05" min="0" value={hangRate} onChange={(e) => setHangRate(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">$/sq ft to hang</p>
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button type="button" size="lg" variant={finish ? "default" : "outline"} className="h-14 flex-1 text-lg" onClick={() => setFinish(!finish)}>
                {finish && <Check className="h-5 w-5" />} Finishing
              </Button>
              <div className="w-32">
                <Input aria-label="Finishing rate per square foot" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" step="0.05" min="0" value={finishRate} onChange={(e) => setFinishRate(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">$/sq ft to finish</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Materials (best guess — change anything)</h3>
            {matLines.map((l) => (
              <div key={l.key} className="space-y-1">
                <Label className="text-base">{l.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`How many: ${l.label}`}
                    className={`${bigInput} w-24`}
                    type="number"
                    onWheel={(e) => e.currentTarget.blur()}
                    inputMode="numeric"
                    min="0"
                    value={l.qty === 0 ? "" : String(l.qty)}
                    onChange={(e) => {
                      setMatTouched((prev) => new Set(prev).add(l.key));
                      updateLine(l.key, { qty: Math.max(0, Math.floor(num(e.target.value))) });
                    }}
                    placeholder="0"
                  />
                  <span className="text-lg text-muted-foreground">× $</span>
                  <Input
                    aria-label={`Price each: ${l.label}`}
                    className={`${bigInput} w-24`}
                    type="number"
                    onWheel={(e) => e.currentTarget.blur()}
                    inputMode="decimal"
                    min="0"
                    value={l.price === 0 ? "" : String(l.price)}
                    onChange={(e) => updateLine(l.key, { price: num(e.target.value) })}
                    placeholder="0"
                  />
                  <span className="ml-auto text-lg font-semibold">{money(l.qty * l.price)}</span>
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label className="text-base" htmlFor="job-extra-materials">Other materials $</Label>
              <Input id="job-extra-materials" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" min="0" value={extraMaterials} onChange={(e) => setExtraMaterials(e.target.value)} placeholder="0" />
            </div>
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Materials total</span>
              <span>{money(materialsTotal)}</span>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Check prices:{" "}
                <a className="underline" href="https://www.lowes.com/search?searchTerm=drywall+materials" target="_blank" rel="noreferrer">Lowe's</a>{" · "}
                <a className="underline" href="https://www.menards.com/main/search.html?search=drywall" target="_blank" rel="noreferrer">Menards</a>{" · "}
                <a className="underline" href="https://www.homedepot.com/s/drywall" target="_blank" rel="noreferrer">Home Depot</a>
              </p>
              <p>Prices in the app are yours to set — tap a store to check today's price.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-base" htmlFor="job-hours">Hours (if hourly)</Label>
              <Input id="job-hours" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label className="text-base" htmlFor="job-hourly">$ per hour</Label>
              <Input id="job-hourly" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" min="0" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Who's working?</h3>
            <div className="flex gap-2">
              <Button type="button" size="lg" variant={crewSize === 1 ? "default" : "outline"} className="h-14 flex-1 text-lg" onClick={() => setCrewSize(1)}>
                {crewSize === 1 && <Check className="h-5 w-5" />} Just Aaron
              </Button>
              <Button type="button" size="lg" variant={crewSize === 2 ? "default" : "outline"} className="h-14 flex-1 text-lg" onClick={() => setCrewSize(2)}>
                {crewSize === 2 && <Check className="h-5 w-5" />} Aaron + helper
              </Button>
            </div>
            {totalHours > 0 ? (
              <p className="text-base text-muted-foreground">
                About {totalHoursR} hours of work ≈ {workDays} {workDays === 1 ? "day" : "days"} with{" "}
                {crewSize === 1 ? "just Aaron" : "Aaron + a helper"}.
                {finish && " Finishing takes at least 3 trips — coats need a day to dry between them."}
              </p>
            ) : (
              <p className="text-base text-muted-foreground">
                Type the square feet above and I'll figure how long this job takes.
              </p>
            )}
          </div>

          {crewSize === 2 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Helper pay (comes out of Aaron's share — not added to the customer's bill)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-base" htmlFor="job-helper-rate">Helper $ per hour</Label>
                  <Input id="job-helper-rate" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" min="0" value={helperRate} onChange={(e) => setHelperRate(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label className="text-base" htmlFor="job-helper-hours">Helper hours</Label>
                  <Input
                    id="job-helper-hours"
                    className={bigInput}
                    type="number"
                    onWheel={(e) => e.currentTarget.blur()}
                    inputMode="decimal"
                    min="0"
                    value={helperHours}
                    onChange={(e) => {
                      setHelperHoursTouched(true);
                      setHelperHours(e.target.value);
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              <p className="text-base text-muted-foreground">Helper gets about {money(helperCost)} on this job.</p>
            </div>
          )}

          <div className="rounded-lg bg-accent p-4 text-center">
            <div className="text-sm text-muted-foreground">TOTAL</div>
            <div className="text-4xl font-bold">{money(total)}</div>
            {owed > 0 && <div className="mt-1 text-base font-semibold text-destructive">Owes {money(owed)}</div>}
            {owed <= 0 && num(paid) > 0 && <div className="mt-1 text-base font-semibold">Paid in full</div>}
          </div>

          {(crewSize === 2 || materialsTotal > 0) && (
            <div className="space-y-1 rounded-lg border p-4 text-lg">
              <div className="flex items-center justify-between">
                <span>Materials in this bid:</span>
                <span className="font-semibold">{money(materialsTotal)}</span>
              </div>
              {crewSize === 2 && (
                <div className="flex items-center justify-between">
                  <span>Helper gets:</span>
                  <span className="font-semibold">{money(helperCost)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>Aaron keeps about:</span>
                <span className="font-bold">{money(aaronKeeps)}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-base" htmlFor="job-deposit">Deposit $</Label>
              <Input id="job-deposit" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label className="text-base" htmlFor="job-paid">Paid $</Label>
              <Input id="job-paid" className={bigInput} type="number" onWheel={(e) => e.currentTarget.blur()} inputMode="decimal" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-base" htmlFor="job-notes">Notes</Label>
            <Textarea id="job-notes" className="text-lg" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h2 className="text-xl font-semibold">Send Invoice</h2>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm leading-relaxed">{buildInvoice()}</pre>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" size="lg" className="h-14 text-base" onClick={sendInvoiceEmail}>
              <Mail className="h-5 w-5" /> Email
            </Button>
            <Button type="button" size="lg" className="h-14 text-base" onClick={sendInvoiceText}>
              <MessageSquare className="h-5 w-5" /> Text
            </Button>
            <Button type="button" size="lg" className="h-14 text-base" onClick={sendInvoiceBoth}>
              <Send className="h-5 w-5" /> Both
            </Button>
          </div>
          <Button type="button" size="lg" variant="outline" className="w-full h-12 text-base" onClick={copyInvoice}>
            <Copy className="h-5 w-5" /> Copy invoice (paste it anywhere)
          </Button>
          <p className="text-sm text-muted-foreground">
            Email and Text open in your own Mail and Messages apps with the invoice filled in — just tap Send there.
          </p>
        </Card>

        <Button size="lg" className="w-full h-14 text-lg" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save Job"}
        </Button>
        {onDelete && (
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-12 text-base"
            onClick={() => {
              if (confirmingDelete) onDelete();
              else {
                setConfirmingDelete(true);
                setTimeout(() => setConfirmingDelete(false), 4000);
              }
            }}
          >
            <Trash2 className="h-5 w-5" />
            {confirmingDelete ? "Tap again to DELETE — this can't be undone" : "Delete this job"}
          </Button>
        )}
      </fieldset>
    </div>
  );
}
