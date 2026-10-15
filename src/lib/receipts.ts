// Receipt / expense search and duplicate detection (pure functions — tested).
//
// Search is a key differentiator: it must filter instantly across vendor,
// amount, date, category, item name, and notes, and never return blank when
// matches exist.

export interface ReceiptPurchase {
  id: string;
  feed_item_id: string;
  store: string | null;
  price_cents: number;
  quantity: number;
  total_lbs: number | null;
  purchased_on: string; // YYYY-MM-DD
  notes: string | null;
  receipt_photo_path: string | null;
  container_id?: string | null;
  /** Resolved feed item name (joined client-side). */
  item_name?: string | null;
}

const MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];
const MONTHS_LONG = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Normalize a query token stream: lowercase, trim, collapse whitespace. */
function norm(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Amount search forms for a price in cents: "12.50", "12.5", "1250", "$12.50". */
function amountForms(cents: number): string[] {
  const dollars = (cents / 100).toFixed(2); // "12.50"
  const forms = new Set<string>([dollars, String(cents)]);
  forms.add(dollars.replace(/0$/, "")); // "12.5"
  forms.add(`$${dollars}`);
  return [...forms];
}

/** Date search forms for YYYY-MM-DD: "oct 14 2026", "10/14/2026", "2026-10-14", "14". */
function dateForms(iso: string): string[] {
  const forms = new Set<string>();
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    forms.add(iso.toLowerCase());
    return [...forms];
  }
  const [, y, mo, d] = m;
  const mi = Number(mo) - 1;
  const day = String(Number(d));
  forms.add(`${y}-${mo}-${d}`);
  forms.add(`${Number(mo)}/${Number(d)}/${y}`);
  forms.add(`${Number(mo)}/${Number(d)}`);
  forms.add(`${MONTHS_SHORT[mi]} ${day} ${y}`);
  forms.add(`${MONTHS_LONG[mi]} ${day} ${y}`);
  forms.add(`${MONTHS_SHORT[mi]} ${day}`);
  forms.add(day);
  forms.add(y);
  return [...forms];
}

/**
 * Instant client-side search over purchases. Every whitespace-separated token
 * in the query must match at least one field (AND semantics). Matching is
 * substring-based and case-insensitive, so partial input filters live.
 */
export function searchPurchases(purchases: ReceiptPurchase[], query: string): ReceiptPurchase[] {
  const q = norm(query);
  if (!q) return purchases;
  const tokens = q.split(" ");
  return purchases.filter((p) => {
    const haystacks: string[] = [
      (p.store ?? "").toLowerCase(),
      (p.item_name ?? "").toLowerCase(),
      (p.notes ?? "").toLowerCase(),
      ...amountForms(Number(p.price_cents ?? 0)),
      ...dateForms(p.purchased_on ?? ""),
    ];
    return tokens.every((t) => haystacks.some((h) => h.includes(t)));
  });
}

export interface DuplicateKey {
  store: string | null;
  price_cents: number;
  purchased_on: string;
}

/**
 * Find an existing purchase with the same vendor + amount + date.
 * Comparison is case-insensitive on vendor and trims whitespace, so
 * "Tractor Supply" matches "tractor supply ".
 */
export function findDuplicatePurchase(
  purchases: ReceiptPurchase[],
  key: DuplicateKey,
): ReceiptPurchase | null {
  const store = (key.store ?? "").trim().toLowerCase();
  for (const p of purchases) {
    if (
      (p.store ?? "").trim().toLowerCase() === store &&
      Number(p.price_cents) === Number(key.price_cents) &&
      p.purchased_on === key.purchased_on
    ) {
      return p;
    }
  }
  return null;
}
