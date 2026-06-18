import type { ApiEnvelope } from "@/lib/types";

export async function fetchApiAction<T>(
  endpoint: string,
  action: string,
  params?: Record<string, string>,
  method: "GET" | "POST" = "GET"
) {
  const url = new URL(endpoint, window.location.origin);

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

export async function fetchAction<T>(
  action: string,
  params?: Record<string, string>,
  method: "GET" | "POST" = "GET"
) {
  return fetchApiAction<T>("/api/mobile-app", action, params, method);
}

export async function fetchPartnerCalendarAction<T>(
  action: string,
  params?: Record<string, string>,
  method: "GET" | "POST" = "GET"
) {
  return fetchApiAction<T>("/api/partner-calendar", action, params, method);
}
