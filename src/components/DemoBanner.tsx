import { Button } from "@/components/ui/button";
import { exitDemoMode, isDemoMode, resetDemo } from "@/lib/demo/mode";
import { RefreshCw, LogOut, Info } from "lucide-react";

export function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950 border-b border-amber-600">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Info className="h-4 w-4 shrink-0" />
          <span className="font-medium truncate">Demo Mode — changes are not saved.</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-7 border-amber-700 bg-amber-100 text-amber-950 hover:bg-amber-200"
            onClick={() => resetDemo()}>
            <RefreshCw className="h-3 w-3" /> Reset
          </Button>
          <Button size="sm" variant="outline" className="h-7 border-amber-700 bg-amber-100 text-amber-950 hover:bg-amber-200"
            onClick={() => exitDemoMode()}>
            <LogOut className="h-3 w-3" /> Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
