import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { describePhoto } from "@/lib/vision.functions";
import { SignedImg } from "@/components/SignedImg";
import type { PhotoBucket } from "@/lib/photo-storage";
import { isDemoMode } from "@/lib/demo/mode";

type Props = {
  bucket: PhotoBucket;
  path: string | null | undefined;
  kind?: "animal" | "general";
  hint?: string;
  /** Text already in the target field — never overwritten without confirmation. */
  currentText?: string | null;
  onApply: (text: string) => void;
  label?: string;
  className?: string;
};

export function DescribePhotoButton({
  bucket, path, kind = "general", hint, currentText, onApply, label = "Describe with AI", className,
}: Props) {
  const [open, setOpen] = useState(false);
  if (!path) return null;
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" /> {label}
      </Button>
      {open && (
        <DescribeDialog
          open={open}
          onOpenChange={setOpen}
          bucket={bucket}
          path={path}
          kind={kind}
          hint={hint}
          currentText={currentText}
          onApply={onApply}
        />
      )}
    </>
  );
}

function DescribeDialog({
  open, onOpenChange, bucket, path, kind, hint, currentText, onApply,
}: Props & { open: boolean; onOpenChange: (v: boolean) => void; path: string }) {
  const run = useServerFn(describePhoto);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const hasExisting = !!(currentText && currentText.trim());

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConfirmReplace(false);
    if (isDemoMode()) {
      setLoading(false);
      setError("AI photo descriptions aren't available in Demo Mode. Sign in to use this.");
      return;
    }
    try {
      const res = await run({ data: { bucket, path, kind: kind ?? "general", ...(hint ? { hint } : {}) } });
      if (res.ok) setText(res.description);
      else setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong analyzing this photo.");
    } finally {
      setLoading(false);
    }
  }, [run, bucket, path, kind, hint]);

  useEffect(() => { void analyze(); }, [analyze]);

  const apply = (mode: "replace" | "append") => {
    const value = mode === "append" && hasExisting ? `${currentText!.trim()}\n${text.trim()}` : text.trim();
    onApply(value);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Describe with AI</DialogTitle>
          <DialogDescription>
            AI observations from the photo. Review and edit before saving — the original photo is never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <SignedImg src={path} bucket={bucket} alt="" className="h-20 w-20 rounded-md object-cover flex-shrink-0 border" />
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-20">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing photo…
              </div>
            ) : error ? (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" /> <span>{error}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Edit anything that looks wrong. Uncertain traits are phrased as possibilities.
              </p>
            )}
          </div>
        </div>

        {!loading && !error && (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            maxLength={2000}
            className="text-sm"
          />
        )}

        {confirmReplace && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm space-y-2">
            <p>This field already has text. Replace it, or add the AI description underneath?</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => apply("append")}>Add below existing</Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => apply("replace")}>Replace existing</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmReplace(false)}>Back</Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" variant="outline" onClick={() => void analyze()} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> {error ? "Try again" : "Regenerate"}
          </Button>
          <Button
            type="button"
            disabled={loading || !!error || !text.trim() || confirmReplace}
            onClick={() => (hasExisting ? setConfirmReplace(true) : apply("replace"))}
          >
            Use description
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
