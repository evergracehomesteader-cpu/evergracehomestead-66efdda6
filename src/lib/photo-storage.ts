import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 10_000_000;

export type PhotoBucket = "animal-photos" | "barter-photos";

/** Extract { bucket, path } from a stored value (legacy public URL or bare path). */
export function parsePhotoRef(value: string, defaultBucket?: PhotoBucket): { bucket: PhotoBucket; path: string } | null {
  if (!value) return null;
  // Match Supabase storage URL pattern (public or signed/authenticated)
  const m = value.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (m) {
    return { bucket: m[1] as PhotoBucket, path: decodeURIComponent(m[2]) };
  }
  // Bare path (preferred new format)
  if (defaultBucket && !value.startsWith("http")) {
    return { bucket: defaultBucket, path: value };
  }
  return null;
}

/** Validate a file is an image within the size cap. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Only JPEG, PNG, WebP, or GIF images are allowed";
  if (file.size > MAX_IMAGE_BYTES) return "Image must be 10 MB or smaller";
  return null;
}

const cache = new Map<string, { url: string; expiresAt: number }>();

/** Get a signed URL for a stored photo value. Caches for ~55 min. */
export async function getSignedPhotoUrl(value: string | null, defaultBucket?: PhotoBucket): Promise<string | null> {
  if (!value) return null;
  const ref = parsePhotoRef(value, defaultBucket);
  if (!ref) return null;
  const cacheKey = `${ref.bucket}/${ref.path}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, 3600);
  if (error || !data) return null;
  cache.set(cacheKey, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

/** React hook: resolves a stored photo value to a signed URL. */
export function useSignedPhoto(value: string | null | undefined, defaultBucket?: PhotoBucket): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!value) { setUrl(null); return; }
    getSignedPhotoUrl(value, defaultBucket).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [value, defaultBucket]);
  return url;
}
