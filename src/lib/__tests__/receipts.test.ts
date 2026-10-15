import { describe, it, expect } from "vitest";
import { searchPurchases, findDuplicatePurchase, type ReceiptPurchase } from "../receipts";

const base: ReceiptPurchase = {
  id: "1",
  feed_item_id: "f1",
  store: "Tractor Supply",
  price_cents: 2499,
  quantity: 50,
  total_lbs: 50,
  purchased_on: "2026-10-14",
  notes: "layer feed for hens",
  receipt_photo_path: null,
  item_name: "Layer Pellets",
};

const purchases: ReceiptPurchase[] = [
  base,
  {
    ...base,
    id: "2",
    store: "Orscheln",
    price_cents: 1850,
    purchased_on: "2026-10-01",
    notes: null,
    item_name: "Goat Feed",
  },
  {
    ...base,
    id: "3",
    store: null,
    price_cents: 500,
    purchased_on: "2026-09-20",
    notes: "cash from neighbor",
    item_name: "Hay Bale",
  },
];

describe("searchPurchases", () => {
  it("returns everything on empty query", () => {
    expect(searchPurchases(purchases, "")).toHaveLength(3);
    expect(searchPurchases(purchases, "   ")).toHaveLength(3);
  });

  it("matches vendor name case-insensitively and partially", () => {
    expect(searchPurchases(purchases, "tractor")).toHaveLength(1);
    expect(searchPurchases(purchases, "TRACTOR SUPPLY")).toHaveLength(1);
    expect(searchPurchases(purchases, "orsch")).toHaveLength(1);
  });

  it("matches amount in multiple forms", () => {
    expect(searchPurchases(purchases, "24.99").map((p) => p.id)).toEqual(["1"]);
    expect(searchPurchases(purchases, "$24.99").map((p) => p.id)).toEqual(["1"]);
    expect(searchPurchases(purchases, "2499").map((p) => p.id)).toEqual(["1"]);
    expect(searchPurchases(purchases, "18.50").map((p) => p.id)).toEqual(["2"]);
  });

  it("matches dates in multiple forms", () => {
    expect(searchPurchases(purchases, "2026-10-14").map((p) => p.id)).toEqual(["1"]);
    expect(searchPurchases(purchases, "10/14/2026").map((p) => p.id)).toEqual(["1"]);
    expect(searchPurchases(purchases, "oct 14").map((p) => p.id)).toEqual(["1"]);
    expect(searchPurchases(purchases, "october 14 2026").map((p) => p.id)).toEqual(["1"]);
  });

  it("matches notes and item name", () => {
    expect(searchPurchases(purchases, "neighbor").map((p) => p.id)).toEqual(["3"]);
    expect(searchPurchases(purchases, "goat feed").map((p) => p.id)).toEqual(["2"]);
    expect(searchPurchases(purchases, "layer")).toHaveLength(1);
  });

  it("requires every token to match (AND semantics)", () => {
    expect(searchPurchases(purchases, "tractor 24.99").map((p) => p.id)).toEqual(["1"]);
    expect(searchPurchases(purchases, "tractor 18.50")).toHaveLength(0);
  });

  it("never returns blank when a match exists (Farmbrite regression)", () => {
    // Partial vendor + partial amount typed fast, as a user would.
    for (const q of ["t", "tr", "tra", "trac", "tract", "tracto", "tractor"]) {
      expect(searchPurchases(purchases, q).length).toBeGreaterThan(0);
    }
    for (const q of ["2", "24", "24.", "24.9", "24.99"]) {
      expect(searchPurchases(purchases, q).length).toBeGreaterThan(0);
    }
  });

  it("handles null store/notes without crashing", () => {
    expect(searchPurchases(purchases, "hay")).toHaveLength(1);
    expect(searchPurchases(purchases, "zzz-no-match")).toHaveLength(0);
  });
});

describe("findDuplicatePurchase", () => {
  it("finds same vendor + amount + date", () => {
    const dup = findDuplicatePurchase(purchases, {
      store: "Tractor Supply",
      price_cents: 2499,
      purchased_on: "2026-10-14",
    });
    expect(dup?.id).toBe("1");
  });

  it("is case- and whitespace-insensitive on vendor", () => {
    const dup = findDuplicatePurchase(purchases, {
      store: "  tractor supply ",
      price_cents: 2499,
      purchased_on: "2026-10-14",
    });
    expect(dup?.id).toBe("1");
  });

  it("returns null when amount or date differs", () => {
    expect(
      findDuplicatePurchase(purchases, {
        store: "Tractor Supply",
        price_cents: 2500,
        purchased_on: "2026-10-14",
      }),
    ).toBeNull();
    expect(
      findDuplicatePurchase(purchases, {
        store: "Tractor Supply",
        price_cents: 2499,
        purchased_on: "2026-10-13",
      }),
    ).toBeNull();
  });

  it("matches null vendors against each other", () => {
    const dup = findDuplicatePurchase(purchases, {
      store: null,
      price_cents: 500,
      purchased_on: "2026-09-20",
    });
    expect(dup?.id).toBe("3");
  });
});
