import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Hand, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * First-run onboarding tour — interactive coach marks.
 *
 * Instead of a text dialog, the tour spotlights the REAL buttons: it dims
 * the screen, rings the control it is talking about, and walks the user
 * page to page ("tap Animals… now tap Add animal"). Highlighted controls
 * stay tappable, and tapping one advances the tour. If a target can't be
 * found (permissions, layout), the step degrades to a centered card so the
 * tour never dead-ends.
 *
 * Shows once per user (per device) shortly after sign-in; completion is
 * remembered in localStorage. Replayable any time by dispatching the
 * `hh:show-tour` window event (Settings page button).
 */

export const TOUR_EVENT = "hh:show-tour";
const tourKey = (userId: string) => `hh_tour_v2_${userId}`;

/* ------------------------------------------------------------------ */
/* Target finding helpers: return the first VISIBLE matching element.  */
/* ------------------------------------------------------------------ */

function isVisible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth)
    return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

function firstVisible(selector: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll(selector))) {
    if (isVisible(el)) return el;
  }
  return null;
}

function linkTo(path: string): HTMLElement | null {
  return firstVisible(`a[href="${path}"]`);
}

function buttonWithText(text: string): HTMLElement | null {
  const buttons = Array.from(
    document.querySelectorAll<HTMLElement>("button, a[role='button']"),
  );
  return (
    buttons.find(
      (b) => isVisible(b) && (b.textContent ?? "").trim().toLowerCase().includes(text.toLowerCase()),
    ) ?? null
  );
}

function moreButton(): HTMLElement | null {
  // The mobile tab bar's "More" button (opens the full menu sheet).
  return buttonWithText("More");
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

type Step = {
  title: string;
  body: string;
  /** Route to be on for this step (navigates when needed). */
  route?: string;
  /** Finds the element to spotlight; omit for a centered card. */
  find?: () => HTMLElement | null;
  /** Show a "go ahead and tap it" hint + advance when the target is tapped. */
  tapHint?: boolean;
};

const STEPS: Step[] = [
  {
    title: "Welcome to Homestead Hub 🌾",
    body: "Quick tour — but this one SHOWS you. I'll glow the real buttons as we go, about a minute total. Follow the glowing rings.",
  },
  {
    title: "Start with your animals",
    body: "Everything lives off your animal list. This is the Animals button — it's always right here.",
    find: () => linkTo("/animals"),
    tapHint: true,
  },
  {
    title: "Adding an animal",
    body: "See the glowing button? That's how every animal gets in — name, breed, birthday, photo, the works. Later, tap it and try one for real.",
    route: "/animals",
    find: () => buttonWithText("Add animal"),
    tapHint: true,
  },
  {
    title: "Chores run themselves",
    body: "This is Chores. Assign them to the family and they check them off as they're done — no more “did anybody feed the goats?”",
    find: () => linkTo("/chores"),
    tapHint: true,
  },
  {
    title: "Making a chore",
    body: "The glowing New chore button is where a chore is born — what it is, who does it, and how often.",
    route: "/chores",
    find: () => buttonWithText("New chore"),
    tapHint: true,
  },
  {
    title: "Feed and receipts",
    body: "Tap Feed to log what you buy. You can even snap a photo of the receipt — handy when feed is cash-only.",
    find: () => linkTo("/feed"),
    tapHint: true,
  },
  {
    title: "Power, people, and everything else",
    body: "Generator fuel, propane, bills, inviting family, and Settings all live in the menu. On a phone it's behind this More button; on a computer, it's the list on the left.",
    find: () => linkTo("/power") ?? moreButton(),
  },
  {
    title: "You're ready 🐐",
    body: "Last thing to know: the app works offline out in the pasture and syncs when you're back in range. Now — go add your first animal!",
  },
];

const PAD = 6; // spotlight padding around the target, px

export function OnboardingTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const openRef = useRef(open);
  openRef.current = open;

  /* ---------------- lifecycle: auto-show once + replay ------------- */

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

  useEffect(() => {
    const show = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, show);
    return () => window.removeEventListener(TOUR_EVENT, show);
  }, []);

  const markDone = useCallback(() => {
    if (user) {
      try {
        localStorage.setItem(tourKey(user.id), "done");
      } catch {
        // Private mode etc. — tour simply offers itself again next time.
      }
    }
  }, [user]);

  const close = useCallback(() => {
    markDone();
    setOpen(false);
    setRect(null);
  }, [markDone]);

  const isLast = step === STEPS.length - 1;

  const next = useCallback(() => {
    if (stepRef.current >= STEPS.length - 1) {
      close();
      navigate({ to: "/animals" });
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }, [close, navigate]);

  const back = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  /* --------- resolve the step's route + target, track its box ------- */

  useEffect(() => {
    if (!open) return;
    const current = STEPS[step];
    setRect(null);
    let cancelled = false;

    if (current.route && window.location.pathname !== current.route) {
      void navigate({ to: current.route });
    }

    if (!current.find) return;

    let found: HTMLElement | null = null;
    let attempts = 0;

    const attach = (el: HTMLElement) => {
      found = el;
      setRect(el.getBoundingClientRect());
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const tryFind = () => {
      if (cancelled || found) return;
      const el = current.find!();
      if (el) {
        attach(el);
        return;
      }
      attempts += 1;
      if (attempts < 20) window.setTimeout(tryFind, 150);
      // Give up gracefully: centered card, no spotlight.
    };
    tryFind();

    const onTapTarget = (e: MouseEvent) => {
      if (found && e.composedPath().includes(found)) {
        // The user tapped the glowing control: let the tap work, then react.
        window.setTimeout(() => {
          if (!openRef.current) return;
          if (STEPS[stepRef.current].route) {
            // Page-action steps (Add animal / New chore): the tap opened the
            // real dialog — end the tour and let them use it.
            close();
          } else if (stepRef.current >= STEPS.length - 1) {
            close();
          } else {
            setStep((s) => Math.min(s + 1, STEPS.length - 1));
          }
        }, 60);
      }
    };
    document.addEventListener("click", onTapTarget, true);

    const track = window.setInterval(() => {
      if (found && document.contains(found)) {
        setRect(found.getBoundingClientRect());
      }
    }, 200);

    return () => {
      cancelled = true;
      document.removeEventListener("click", onTapTarget, true);
      window.clearInterval(track);
    };
  }, [open, step, navigate, close]);

  if (!open) return null;

  const current = STEPS[step];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  /* Spotlight geometry (hole left uncovered so the control is tappable). */
  const hole = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: Math.min(vw, rect.width + PAD * 2),
        height: rect.height + PAD * 2,
      }
    : null;
  if (hole) hole.width = Math.min(hole.width, vw - hole.left);

  /* Tooltip placement: below the target if there's room, else above,
     else centered on screen (no-target and fallback steps). */
  const CARD_W = Math.min(340, vw - 24);
  let cardStyle: React.CSSProperties;
  if (hole) {
    const left = Math.min(Math.max(12, hole.left + hole.width / 2 - CARD_W / 2), vw - CARD_W - 12);
    const belowTop = hole.top + hole.height + 14;
    if (belowTop < vh - 190) {
      cardStyle = { left, top: belowTop, width: CARD_W };
    } else {
      cardStyle = { left, bottom: vh - hole.top + 14, width: CARD_W };
    }
  } else {
    cardStyle = {
      left: (vw - CARD_W) / 2,
      top: Math.max(16, vh / 2 - 130),
      width: CARD_W,
    };
  }

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label="App tour"
    >
      {/* Dimmed shade — four panels around the hole (or one solid overlay).
          Panels take pointer-events-auto so stray taps land on the shade,
          while the hole itself stays uncovered AND the root is
          pointer-events-none, so taps over the hole reach the real control. */}
      {hole ? (
        <>
          <div className="absolute bg-black/60 pointer-events-auto" style={{ top: 0, left: 0, width: vw, height: hole.top }} />
          <div
            className="absolute bg-black/60 pointer-events-auto"
            style={{ top: hole.top + hole.height, left: 0, width: vw, height: Math.max(0, vh - hole.top - hole.height) }}
          />
          <div
            className="absolute bg-black/60 pointer-events-auto"
            style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
          />
          <div
            className="absolute bg-black/60 pointer-events-auto"
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              width: Math.max(0, vw - hole.left - hole.width),
              height: hole.height,
            }}
          />
          {/* Glowing ring around the target */}
          <div
            className="absolute rounded-xl border-[3px] border-primary shadow-[0_0_0_4px_rgba(255,255,255,0.35)] animate-pulse pointer-events-none"
            style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/60 pointer-events-auto" />
      )}

      {/* Tour card */}
      <div
        className="absolute rounded-2xl bg-card text-card-foreground shadow-2xl border p-4 pointer-events-auto"
        style={cardStyle}
      >
        <button
          type="button"
          onClick={close}
          aria-label="End tour"
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          Tour · Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="font-display text-lg font-semibold mt-1 pr-5">{current.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{current.body}</p>

        {current.tapHint && hole && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Hand className="h-3.5 w-3.5" /> Go ahead — you can tap the glowing spot, or just press Next.
          </p>
        )}

        <div className="flex items-center justify-center gap-1.5 py-3" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i === step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {isLast ? (
          <div className="flex flex-col gap-2">
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
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={back}>
              Back
            </Button>
            <Button variant="ghost" size="sm" onClick={close}>
              Skip tour
            </Button>
            <Button size="sm" className="ml-auto px-5" onClick={next}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
