import { describe, it, expect } from "vitest";
import { removeFromHomestead, assertUserDeletable } from "../homestead-membership";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const TARGET_ID = "22222222-2222-2222-2222-222222222222";
const HOMESTEAD_ID = "33333333-3333-3333-3333-333333333333";

type FakeOpts = {
  homesteadRow?: { id: string; name: string; owner_id: string } | null;
  homesteadError?: string;
  ownedRows?: { id: string; name: string }[];
  ownedError?: string;
  memberRow?: { user_id: string } | null;
  memberError?: string;
  memberDeleteError?: string;
  authDeleteError?: string;
};

/** Minimal chainable fake of the supabaseAdmin client. */
function makeFakeAdmin(opts: FakeOpts = {}) {
  const calls = { memberDelete: 0, authDelete: 0, authDeleteIds: [] as string[] };
  const err = (msg?: string) => (msg ? { message: msg } : null);

  const client = {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, _val: string) => {
          if (table === "homesteads" && col === "owner_id") {
            return Promise.resolve({ data: opts.ownedRows ?? [], error: err(opts.ownedError) });
          }
          if (table === "homesteads" && col === "id") {
            return {
              single: () =>
                Promise.resolve({ data: opts.homesteadRow ?? null, error: err(opts.homesteadError) }),
            };
          }
          if (table === "homestead_members" && col === "homestead_id") {
            return {
              eq: (_c2: string, _v2: string) => ({
                maybeSingle: () =>
                  Promise.resolve({ data: opts.memberRow ?? null, error: err(opts.memberError) }),
              }),
            };
          }
          throw new Error(`unexpected select query: ${table}.${col}`);
        },
      }),
      delete: () => ({
        eq: (_c1: string, _v1: string) => ({
          eq: (_c2: string, _v2: string) => {
            calls.memberDelete++;
            return Promise.resolve({ error: err(opts.memberDeleteError) });
          },
        }),
      }),
    }),
    auth: {
      admin: {
        deleteUser: (id: string) => {
          calls.authDelete++;
          calls.authDeleteIds.push(id);
          return Promise.resolve({ error: err(opts.authDeleteError) });
        },
      },
    },
  };
  return { client, calls };
}

const homestead = { id: HOMESTEAD_ID, name: "EverGrace Homestead", owner_id: ADMIN_ID };

describe("removeFromHomestead", () => {
  it("throws when removing yourself", async () => {
    const { client, calls } = makeFakeAdmin({ homesteadRow: homestead, memberRow: { user_id: TARGET_ID } });
    await expect(removeFromHomestead(client, ADMIN_ID, HOMESTEAD_ID, ADMIN_ID)).rejects.toThrow(
      "You cannot remove yourself from the homestead.",
    );
    expect(calls.memberDelete).toBe(0);
  });

  it("throws a clear error when the target owns the homestead", async () => {
    const owned = { ...homestead, owner_id: TARGET_ID };
    const { client, calls } = makeFakeAdmin({ homesteadRow: owned });
    await expect(removeFromHomestead(client, TARGET_ID, HOMESTEAD_ID, ADMIN_ID)).rejects.toThrow(
      'This user owns "EverGrace Homestead". Transfer ownership to another member before removing them.',
    );
    expect(calls.memberDelete).toBe(0);
  });

  it("throws when the target is not a member", async () => {
    const { client, calls } = makeFakeAdmin({ homesteadRow: homestead, memberRow: null });
    await expect(removeFromHomestead(client, TARGET_ID, HOMESTEAD_ID, ADMIN_ID)).rejects.toThrow(
      'This user is not a member of "EverGrace Homestead".',
    );
    expect(calls.memberDelete).toBe(0);
  });

  it("removes the member and returns the homestead name", async () => {
    const { client, calls } = makeFakeAdmin({ homesteadRow: homestead, memberRow: { user_id: TARGET_ID } });
    const result = await removeFromHomestead(client, TARGET_ID, HOMESTEAD_ID, ADMIN_ID);
    expect(calls.memberDelete).toBe(1);
    expect(result).toEqual({ ok: true, homesteadName: "EverGrace Homestead" });
  });

  it("surfaces homestead lookup errors", async () => {
    const { client } = makeFakeAdmin({ homesteadError: "connection lost" });
    await expect(removeFromHomestead(client, TARGET_ID, HOMESTEAD_ID, ADMIN_ID)).rejects.toThrow(
      "connection lost",
    );
  });

  it("surfaces membership delete errors", async () => {
    const { client } = makeFakeAdmin({
      homesteadRow: homestead,
      memberRow: { user_id: TARGET_ID },
      memberDeleteError: "permission denied",
    });
    await expect(removeFromHomestead(client, TARGET_ID, HOMESTEAD_ID, ADMIN_ID)).rejects.toThrow(
      "permission denied",
    );
  });
});

describe("assertUserDeletable", () => {
  it("throws when deleting yourself", async () => {
    const { client } = makeFakeAdmin({ ownedRows: [] });
    await expect(assertUserDeletable(client, ADMIN_ID, ADMIN_ID)).rejects.toThrow(
      "You cannot delete your own account.",
    );
  });

  it("throws a clear error listing owned homesteads", async () => {
    const { client, calls } = makeFakeAdmin({
      ownedRows: [
        { id: "a", name: "EverGrace Homestead" },
        { id: "b", name: "Pip's Homestead" },
      ],
    });
    await expect(assertUserDeletable(client, TARGET_ID, ADMIN_ID)).rejects.toThrow(
      'This user owns 2 homesteads ("EverGrace Homestead", "Pip\'s Homestead"). ' +
        'Transfer ownership to another user before deleting the account. ' +
        'To just revoke their access, use "Remove from homestead" instead.',
    );
    expect(calls.authDelete).toBe(0);
  });

  it("uses singular wording for one homestead", async () => {
    const { client } = makeFakeAdmin({ ownedRows: [{ id: "a", name: "EverGrace Homestead" }] });
    await expect(assertUserDeletable(client, TARGET_ID, ADMIN_ID)).rejects.toThrow(
      'This user owns 1 homestead ("EverGrace Homestead").',
    );
  });

  it("resolves when the user owns nothing", async () => {
    const { client } = makeFakeAdmin({ ownedRows: [] });
    await expect(assertUserDeletable(client, TARGET_ID, ADMIN_ID)).resolves.toBeUndefined();
  });

  it("surfaces query errors", async () => {
    const { client } = makeFakeAdmin({ ownedError: "connection lost" });
    await expect(assertUserDeletable(client, TARGET_ID, ADMIN_ID)).rejects.toThrow("connection lost");
  });
});
