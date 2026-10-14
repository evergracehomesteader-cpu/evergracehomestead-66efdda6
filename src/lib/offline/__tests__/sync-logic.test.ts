import { describe, expect, it } from "vitest";
import { buildOutboxEntry } from "../db";
import {
  advanceWatermark,
  backoffMs,
  lwwWinner,
  sortOutboxEntries,
} from "../sync-logic";
import { applyLocalQuery, type LocalFilter } from "../query-shim";

describe("buildOutboxEntry", () => {
  it("builds a well-formed entry with zero attempts", () => {
    const e = buildOutboxEntry("animals", "insert", "abc", { id: "abc", name: "X" });
    expect(e.table).toBe("animals");
    expect(e.op).toBe("insert");
    expect(e.rowId).toBe("abc");
    expect(e.payload).toEqual({ id: "abc", name: "X" });
    expect(e.attempts).toBe(0);
    expect(e.lastError).toBeNull();
    expect(e.nextRetryAt).toBeNull();
    expect(typeof e.createdAt).toBe("string");
  });

  it("allows null payload for deletes", () => {
    const e = buildOutboxEntry("chores", "delete", "d1", null);
    expect(e.op).toBe("delete");
    expect(e.payload).toBeNull();
  });
});

describe("sortOutboxEntries (FIFO with table priority)", () => {
  it("drains parent tables before child tables", () => {
    const child = buildOutboxEntry("health_records", "insert", "h1", {});
    child.id = 1;
    const parent = buildOutboxEntry("animals", "insert", "a1", {});
    parent.id = 2;
    const sorted = sortOutboxEntries([child, parent]);
    expect(sorted.map((e) => e.table)).toEqual(["animals", "health_records"]);
  });

  it("keeps FIFO order within the same tier", () => {
    const mk = (table: "animals" | "pens", id: number) => {
      const e = buildOutboxEntry(table, "update", `r${id}`, {});
      e.id = id;
      return e;
    };
    const sorted = sortOutboxEntries([mk("pens", 30), mk("animals", 10), mk("pens", 20)]);
    expect(sorted.map((e) => e.id)).toEqual([10, 20, 30]);
  });

  it("orders chore children after chores", () => {
    const comp = buildOutboxEntry("chore_completions", "insert", "c1", {});
    comp.id = 1;
    const assign = buildOutboxEntry("chore_assignments", "insert", "a1", {});
    assign.id = 2;
    const chore = buildOutboxEntry("chores", "insert", "ch1", {});
    chore.id = 3;
    const sorted = sortOutboxEntries([comp, assign, chore]);
    expect(sorted[0].table).toBe("chores");
    expect(sorted.map((e) => e.id)).toEqual([3, 1, 2]);
  });
});

describe("lwwWinner", () => {
  it("remote wins when its watermark is newer", () => {
    expect(lwwWinner("2026-10-12T10:00:00Z", "2026-10-13T10:00:00Z")).toBe("remote");
  });
  it("local wins when its watermark is newer", () => {
    expect(lwwWinner("2026-10-13T10:00:00Z", "2026-10-12T10:00:00Z")).toBe("local");
  });
  it("tie when watermarks are equal", () => {
    expect(lwwWinner("2026-10-13T10:00:00Z", "2026-10-13T10:00:00Z")).toBe("tie");
  });
  it("remote wins when local watermark is missing (legacy row)", () => {
    expect(lwwWinner(undefined, "2026-10-13T10:00:00Z")).toBe("remote");
  });
  it("tie when both watermarks are missing", () => {
    expect(lwwWinner(undefined, undefined)).toBe("tie");
  });
});

describe("advanceWatermark", () => {
  it("advances to the newest row watermark", () => {
    const next = advanceWatermark("2026-10-12T00:00:00Z", [
      { id: "a", updated_at: "2026-10-12T01:00:00Z" },
      { id: "b", updated_at: "2026-10-13T05:00:00Z" },
    ], "updated_at");
    expect(next).toBe("2026-10-13T05:00:00Z");
  });
  it("keeps the previous watermark when nothing newer arrived", () => {
    const next = advanceWatermark("2026-10-13T05:00:00Z", [
      { id: "a", updated_at: "2026-10-12T01:00:00Z" },
    ], "updated_at");
    expect(next).toBe("2026-10-13T05:00:00Z");
  });
  it("starts from null and returns null on empty pull", () => {
    expect(advanceWatermark(null, [], "created_at")).toBeNull();
  });
  it("uses the table's own watermark column (completed_at)", () => {
    const next = advanceWatermark(null, [{ id: "c", completed_at: "2026-10-13T07:00:00Z" }], "completed_at");
    expect(next).toBe("2026-10-13T07:00:00Z");
  });
});

describe("backoffMs", () => {
  it("backs off exponentially and caps at 60s", () => {
    expect(backoffMs(1)).toBe(5000);
    expect(backoffMs(2)).toBe(15000);
    expect(backoffMs(3)).toBe(30000);
    expect(backoffMs(4)).toBe(60000);
    expect(backoffMs(10)).toBe(60000);
  });
});

describe("applyLocalQuery (offline filter subset)", () => {
  const rows = [
    { id: "1", species: "goat", name: "Melania", age: 1 },
    { id: "2", species: "pig", name: "Bertha", age: 4 },
    { id: "3", species: "goat", name: "Joy", age: 2 },
  ];
  const noFilters: LocalFilter[] = [];

  it("eq + order + limit", () => {
    const out = applyLocalQuery(
      rows,
      [{ type: "eq", col: "species", value: "goat" }],
      [{ col: "age", ascending: false }],
      1,
    );
    expect(out.map((r) => r.id)).toEqual(["3"]);
  });

  it("in filter", () => {
    const out = applyLocalQuery(rows, [{ type: "in", col: "id", value: ["1", "3"] }], [], null);
    expect(out).toHaveLength(2);
  });

  it("neq + gt", () => {
    const out = applyLocalQuery(
      rows,
      [
        { type: "neq", col: "species", value: "pig" },
        { type: "gt", col: "age", value: 1 },
      ],
      [],
      null,
    );
    expect(out.map((r) => r.id)).toEqual(["3"]);
  });

  it("no filters returns all rows", () => {
    expect(applyLocalQuery(rows, noFilters, [], null)).toHaveLength(3);
  });
});
