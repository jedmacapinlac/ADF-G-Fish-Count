/** Shared fetch for the JSON routes in api/routes.py.
 *
 *  Every call site passes a root-relative path like "/api/locations". In
 *  production that's wrong on its own — this app is served under
 *  goaflow.org/fish-count/, not the domain root, so a root-relative fetch
 *  would hit whatever else lives at goaflow.org/api/ instead of this app's
 *  backend. import.meta.env.BASE_URL is Vite's own record of that prefix
 *  (see vite.config.ts's `base`), so stripping the leading slash off `path`
 *  and joining it there reproduces the right URL in both places: BASE_URL
 *  is "/" in dev, so this is a no-op locally, and "/fish-count/" in the
 *  production build.
 *
 *  Errors name the route and status so the UI can surface them verbatim —
 *  "GET /api/counts → 500" is a lot more actionable than "failed to fetch".
 */
export async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const url = import.meta.env.BASE_URL + path.replace(/^\//, '')
  const res = await fetch(url, { signal })
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
