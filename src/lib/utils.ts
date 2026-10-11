import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a checked-at timestamp as a locale date string.
 *  Pure (no `Date.now()`), so it renders identically on server and client and
 *  never triggers a hydration mismatch. Returns "" when there is no timestamp. */
export function formatCheckedDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, { dateStyle: "medium" });
}
