import { SUPABASE_URL } from "@/lib/env";

export const PHOTO_BUCKET = "candidate-photos";
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const publicPrefix = () => `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/`;

// Returns the object path if the URL points into our photo bucket, else null.
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = publicPrefix();
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}

// Only our own bucket or the bundled placeholders are accepted as photo URLs.
export function isAllowedPhotoUrl(url: string): boolean {
  return storagePathFromUrl(url) !== null || /^\/dummy\/[\w.-]+$/.test(url);
}
