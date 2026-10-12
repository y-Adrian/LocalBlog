/** Explicit all-time range avoids reusing the old default-range zero cache. */
export function pageViewsURL(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/counter/${encodeURIComponent(path)}.json?start=1970-01-01`
}

export async function readPageViews(response: Response): Promise<string> {
  if (!response.ok && response.status !== 404) {
    throw new Error(`Page view endpoint returned HTTP ${response.status}`)
  }
  // GoatCounter returns a JSON count of zero with 404 for an unrecorded path.
  // A missing/invalid body or other 404 must not be presented as zero views.
  const data = (await response.json()) as { count?: unknown }
  const count = typeof data.count === "number" ? String(data.count) : data.count
  if (typeof count !== "string" || !/^\d[\d\s,.]*$/u.test(count)) {
    throw new Error("Page view endpoint returned an invalid count")
  }
  return count
}
