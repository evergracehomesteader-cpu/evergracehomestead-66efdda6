// Demo Mode flag + lifecycle. All state lives in localStorage so real Supabase
// is never touched while demo is active.
const FLAG_KEY = "demo_mode";
const DB_KEY = "demo_db";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export async function enterDemoMode(): Promise<void> {
  const { buildSeed } = await import("./seed");
  const db = buildSeed();
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  window.localStorage.setItem(FLAG_KEY, "1");
  window.location.href = "/dashboard";
}

export async function resetDemo(): Promise<void> {
  const { buildSeed } = await import("./seed");
  const db = buildSeed();
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
  window.location.reload();
}

export function exitDemoMode(): void {
  window.localStorage.removeItem(FLAG_KEY);
  window.localStorage.removeItem(DB_KEY);
  window.location.href = "/login";
}

export function readDb(): Record<string, Record<string, unknown>[]> {
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeDb(db: Record<string, Record<string, unknown>[]>): void {
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}
