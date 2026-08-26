import { useEffect, useState } from 'react'

import { fetchJson, isAbortError, toMessage } from './api'

/** Fetches a JSON route, or nothing at all when `path` is null.
 *
 *  The null case is what makes this usable from components that render before
 *  they know what to ask for — no site picked yet, no series chosen yet. Hooks
 *  cannot be called conditionally, so the condition moves into the argument.
 *
 *  `path` is a string, so the effect re-runs exactly when the URL changes.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    if (path === null) return

    const controller = new AbortController()

    fetchJson<T>(path, controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(toMessage(err))
      })

    return () => controller.abort()
  }, [path])

  return { data, error }
}
