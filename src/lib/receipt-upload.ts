// Receipt photo capture, offline queueing, and drain.
//
// Flow:
// - Online: photo uploads straight to the private `receipt-photos` bucket and
//   the storage path is saved on the feed_purchases row.
// - Offline: the photo blob is cached in the Dexie `pending_photos` store
//   keyed by the (locally generated) purchase id. When connectivity returns,
//   `drainPendingPhotos` uploads each blob and patches the purchase row via
//   the offline-first queued client (FIFO outbox keeps insert-before-update
//   ordering even if the purchase itself hasn't pushed yet).
import { supabase } from "@/lib/supabase";
import { getDb, nowISO, type PendingPhoto } from "@/lib/offline/db";
import { validateImageFile } from "@/lib/photo-storage";

export const RECEIPT_BUCKET = "receipt-photos";

const isOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

function extFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,4}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[file.type] ?? "jpg";
}

/**
 * Upload a receipt photo right now. Returns the storage path to save on the
 * purchase row. Throws on validation or upload failure.
 */
export async function uploadReceiptPhoto(file: File, userId: string): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const path = `${userId}/${crypto.randomUUID()}.${extFor(file)}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, {
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

/** Cache a receipt photo blob locally until connectivity returns. */
export async function queueReceiptPhoto(purchaseId: string, file: File): Promise<number> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const entry: PendingPhoto = {
    purchaseId,
    blob: file,
    fileName: file.name || "receipt.jpg",
    contentType: file.type,
    createdAt: nowISO(),
  };
  return getDb().pending_photos.add(entry);
}

/** Object URLs for offline-captured photos (revoke when done via revokePendingPhotoUrl). */
const objectUrlCache = new Map<number, string>();

/** Local preview URL for a pending photo belonging to a purchase, if any. */
export async function getPendingPhotoUrl(purchaseId: string): Promise<string | null> {
  const rec = await getDb().pending_photos.where("purchaseId").equals(purchaseId).first();
  if (!rec || rec.id == null) return null;
  let url = objectUrlCache.get(rec.id);
  if (!url) {
    url = URL.createObjectURL(rec.blob);
    objectUrlCache.set(rec.id, url);
  }
  return url;
}

export function revokePendingPhotoUrl(purchaseId: string): void {
  // Best-effort cleanup; stale entries are harmless (page-lifetime cache).
  void getDb()
    .pending_photos.where("purchaseId")
    .equals(purchaseId)
    .first()
    .then((rec) => {
      if (rec?.id != null) {
        const url = objectUrlCache.get(rec.id);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrlCache.delete(rec.id);
        }
      }
    });
}

/**
 * Upload every queued offline receipt photo and patch its purchase row with
 * the storage path. Safe to call any time; no-ops when offline or empty.
 * Failures are left queued for the next drain.
 */
export async function drainPendingPhotos(): Promise<{ uploaded: number; failed: number }> {
  let uploaded = 0;
  let failed = 0;
  if (!isOnline()) return { uploaded, failed };
  let pending: PendingPhoto[];
  try {
    pending = await getDb().pending_photos.orderBy("createdAt").toArray();
  } catch {
    return { uploaded, failed };
  }
  if (pending.length === 0) return { uploaded, failed };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "anon";

  for (const rec of pending) {
    if (rec.id == null) continue;
    try {
      const file = new File([rec.blob], rec.fileName, { type: rec.contentType });
      const path = await uploadReceiptPhoto(file, userId);
      // Queued client: local-first update + outbox entry, FIFO after the insert.
      const { error } = await supabase
        .from("feed_purchases")
        .update({ receipt_photo_path: path } as never)
        .eq("id", rec.purchaseId);
      if (error) throw error;
      await getDb().pending_photos.delete(rec.id);
      const url = objectUrlCache.get(rec.id);
      if (url) {
        URL.revokeObjectURL(url);
        objectUrlCache.delete(rec.id);
      }
      uploaded++;
    } catch {
      failed++;
    }
  }
  return { uploaded, failed };
}

let drainInit = false;

/**
 * Start background draining of offline receipt photos. Call once from app
 * boot (browser-only). Drains on init, on 'online', and when the tab becomes
 * visible.
 */
export function initReceiptPhotoDrain(): void {
  if (drainInit || typeof window === "undefined") return;
  drainInit = true;
  const kick = () => {
    void drainPendingPhotos().catch(() => {});
  };
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") kick();
  });
  setTimeout(kick, 5000);
}

/** True when there are offline receipt photos still waiting to upload. */
export async function pendingPhotoCount(): Promise<number> {
  try {
    return await getDb().pending_photos.count();
  } catch {
    return 0;
  }
}
