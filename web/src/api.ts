/** Shared fetch for the JSON routes in api/routes.py.
 *
 *  Errors name the route and status so the UI can surface them verbatim —
 *  "GET /api/counts → 500" is a lot more actionable than "failed to fetch".
 */
export async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return (await res.json()) as T
}

/** An aborted request is the normal result of an effect re-running or a
 *  component unmounting, not something to show the user. */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

export function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
