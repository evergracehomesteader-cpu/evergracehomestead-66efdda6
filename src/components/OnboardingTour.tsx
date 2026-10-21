import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sprout,
  PawPrint,
  CalendarCheck,
  Wheat,
  Zap,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * First-run onboarding tour.
 *
 * Shows once per user (per device) shortly after sign-in: a short, skippable
 * walkthrough of the main sections, ending with an "add your first animal"
 * call to action. Completion is remembered in localStorage. It can be
 * replayed any time by dispatching a `hh:show-tour` window event (the
 * Settings page has a button that does this).
 */

export const TOUR_EVENT = "hh:show-tour";
const tourKey = (userId: string) => `hh_tour_v1_${userId}`;

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: Sprout,
    title: "Welcome to Homestead Hub",
    body: "Your whole homestead in one place — animals, chores, feed, and money. This quick tour takes about two minutes and shows you where everything lives.",
  },
  {
    icon: PawPrint,
    title: "Animals first",
    body: "Add each animal once and keep its whole story together: health records, breeding, weights, and photos. You'll find them under Animals in the menu.",
  },
  {
    icon: CalendarCheck,
    title: "Chores that run themselves",
    body: "Assign chores to family members and they check them off as they're done — no more wondering whether the goats got fed. Set them up under Chores.",
  },
  {
    icon: Wheat,
    title: "Feed, receipts, and money",
    body: "Log feed purchases (snap a photo of the receipt — handy when you pay cash) and track bills and income, so you always know what the homestead costs and what it earns.",
  },
  {
    icon: Zap,
    title: "Power and weather that watch out for you",
    body: "Track generator fuel and propane under Power, and get weather alerts that know about your animals — freeze, heat, and storm warnings before they become emergencies.",
  },
  {
    icon: Users,
    title: "Bring your people in",
    body: "Homestead Hub is built for the whole household. Invite family from the Homestead page and give each person a role — roles control who can see things like money and reports.",
  },
  {
    icon: WifiOff,
    title: "Works out in the pasture",
    body: "No signal? No problem. Homestead Hub works fully offline and syncs everything when you're back in range. Ready to start?",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-show once for new users.
  useEffect(() => {
    if (!user || isDemoMode()) return;
    let done = false;
    try {
      done = localStorage.getItem(tourKey(user.id)) === "done";
    } catch {
      done = true;
    }
    if (done) return;
    const t = setTimeout(() => {
      setStep(0);
      setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, [user]);

  // Replay on demand (Settings button).
  useEffect(() => {
    const show = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, show);
    return () => window.removeEventListener(TOUR_EVENT, show);
  }, []);

  const markDone = () => {
    if (user) {
      try {
        localStorage.setItem(tourKey(user.id), "done");
      } catch {
        // Private mode etc. — tour will simply offer itself again next time.
      }
    }
  };

  const close = () => {
    markDone();
    setOpen(false);
  };

  const isLast = step === STEPS.length - 1;
  const Current = STEPS[step];
  const Icon = Current.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Icon className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center font-display text-xl">{Current.title}</DialogTitle>
          <DialogDescription className="text-center">{Current.body}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5 py-1" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${i === step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground -mt-1">
          Step {step + 1} of {STEPS.length}
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isLast ? (
            <>
              <Button
                className="w-full"
                onClick={() => {
                  close();
                  navigate({ to: "/animals" });
                }}
              >
                Add your first animal
              </Button>
              <Button variant="outline" className="w-full" onClick={close}>
                Look around on my own
              </Button>
            </>
          ) : (
            <>
              <Button className="w-full" onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}>
                Next
              </Button>
              <div className="flex w-full gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(s - 1, 0))}
                >
                  Back
                </Button>
                <Button variant="ghost" className="flex-1" onClick={close}>
                  Skip tour
                </Button>
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
