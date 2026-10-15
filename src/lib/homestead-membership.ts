/**
 * Pure business logic for homestead membership changes.
 *
 * Kept free of server-function wrappers so it can be unit-tested with a fake
 * Supabase client. The createServerFn wrappers in admin-users.functions.ts
 * handle auth and delegate here.
 *
 * NOTE: `user_roles` is a GLOBAL table (app-wide roles), not per-homestead.
 * Removing a member from a homestead must only touch `homestead_members` —
 * never `user_roles`.
 */

export type HomesteadOwnership = { id: string; name: string; owner_id?: string };

/**
 * Remove a user from a single homestead (revoke access, keep the account).
 *
 * Throws a human-readable error when:
 * - the target is the caller themselves,
 * - the target owns the homestead (ownership must be transferred first),
 * - the target is not a member of the homestead,
 * - any database call fails.
 */
export async function removeFromHomestead(
  supabaseAdmin: any,
  targetUserId: string,
  homesteadId: string,
  currentUserId: string,
): Promise<{ ok: true; homesteadName: string }> {
  if (targetUserId === currentUserId) {
    throw new Error("You cannot remove yourself from the homestead.");
  }

  const { data: hs, error: hsError } = await supabaseAdmin
    .from("homesteads")
    .select("id, name, owner_id")
    .eq("id", homesteadId)
    .single();
  if (hsError) throw new Error(hsError.message);
  if (!hs) throw new Error("Homestead not found.");

  if (hs.owner_id === targetUserId) {
    throw new Error(
      `This user owns "${hs.name}". Transfer ownership to another member before removing them.`,
    );
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("homestead_members")
    .select("user_id")
    .eq("homestead_id", homesteadId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (!member) {
    throw new Error(`This user is not a member of "${hs.name}".`);
  }

  const { error } = await supabaseAdmin
    .from("homestead_members")
    .delete()
    .eq("homestead_id", homesteadId)
    .eq("user_id", targetUserId);
  if (error) throw new Error(error.message);

  return { ok: true, homesteadName: hs.name };
}

/**
 * Guard for full account deletion.
 *
 * `homesteads.owner_id` is ON DELETE RESTRICT against auth.users, so deleting
 * an owner via the Auth API fails with GoTrue's cryptic "Database error
 * deleting user". Check first and explain what to do instead.
 */
export async function assertUserDeletable(
  supabaseAdmin: any,
  targetUserId: string,
  currentUserId: string,
): Promise<void> {
  if (targetUserId === currentUserId) {
    throw new Error("You cannot delete your own account.");
  }

  const { data: owned, error } = await supabaseAdmin
    .from("homesteads")
    .select("id, name")
    .eq("owner_id", targetUserId);
  if (error) throw new Error(error.message);

  const homesteads: HomesteadOwnership[] = owned ?? [];
  if (homesteads.length > 0) {
    const names = homesteads.map((h) => `"${h.name}"`).join(", ");
    const plural = homesteads.length === 1 ? "" : "s";
    throw new Error(
      `This user owns ${homesteads.length} homestead${plural} (${names}). ` +
        `Transfer ownership to another user before deleting the account. ` +
        `To just revoke their access, use "Remove from homestead" instead.`,
    );
  }
}
