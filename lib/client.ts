import type { ApiEnvelope } from "@/lib/types";

export async function fetchAction<T>(
  action: string,
  params?: Record<string, string>,
  method: "GET" | "POST" = "GET"
) {
  const url = new URL("/api/mobile-app", window.location.origin);

  if (method === "GET") {
    url.searchParams.set("action", action);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  } else {
    url.searchParams.set("action", action);
  }

  const response = await fetch(url.toString(), {
    method,
    cache: "no-store",
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify({ action, ...(params || {}) }) : undefined
  });

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

// In-memory, per-session cache for *static* GET actions (e.g. activity_types,
// task_form_options). These are master-data lists that change rarely but were
// previously refetched on every poll, multiplying ERPNext load under concurrency.
// Caching the in-flight promise also dedupes concurrent callers across screens.
type CacheEntry = { expires: number; promise: Promise<ApiEnvelope<unknown>> };

const DEFAULT_STATIC_TTL_MS = 10 * 60 * 1000;
const actionCache = new Map<string, CacheEntry>();

function cacheKey(action: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) {
    return action;
  }
  return `${action}?${new URLSearchParams(params).toString()}`;
}

export async function fetchActionCached<T>(
  action: string,
  params?: Record<string, string>,
  ttlMs: number = DEFAULT_STATIC_TTL_MS
): Promise<ApiEnvelope<T>> {
  const key = cacheKey(action, params);
  const now = Date.now();
  const existing = actionCache.get(key);

  if (existing && existing.expires > now) {
    return existing.promise as Promise<ApiEnvelope<T>>;
  }

  const promise = fetchAction<T>(action, params);

  // Do not cache failures: evict so the next call retries.
  promise.catch(() => {
    const current = actionCache.get(key);
    if (current && current.promise === promise) {
      actionCache.delete(key);
    }
  });

  actionCache.set(key, { expires: now + ttlMs, promise: promise as Promise<ApiEnvelope<unknown>> });
  return promise;
}

export function invalidateCachedAction(action?: string) {
  if (!action) {
    actionCache.clear();
    return;
  }
  for (const key of Array.from(actionCache.keys())) {
    if (key === action || key.startsWith(`${action}?`)) {
      actionCache.delete(key);
    }
  }
}
