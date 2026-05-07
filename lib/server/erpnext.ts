import { NextResponse } from "next/server";

const baseUrl = process.env.ERPNEXT_BASE_URL?.replace(/\/$/, "");
const methodName = process.env.ERPNEXT_SERVER_SCRIPT_METHOD || "task_mobile_app_api";
const apiKey = process.env.ERPNEXT_API_KEY;
const apiSecret = process.env.ERPNEXT_API_SECRET;

export type SessionData = {
  user: {
    email: string;
    displayName: string;
  };
  sid?: string;
};

function stringifyUnknown(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value instanceof Error && value.message.trim()) {
    return value.message;
  }

  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return null;
}

function extractErpErrorMessage(payload: {
  message?: unknown;
  exception?: string;
  exc?: string;
}) {
  const nestedMessage =
    payload.message && typeof payload.message === "object"
      ? (payload.message as { error?: unknown; message?: unknown }).error ??
        (payload.message as { error?: unknown; message?: unknown }).message
      : payload.message;

  return (
    stringifyUnknown(nestedMessage) ??
    stringifyUnknown(payload.exception) ??
    stringifyUnknown(payload.exc) ??
    "ERPNext API request failed."
  );
}

function getDisplayName(email: string) {
  const stem = email.split("@")[0] || email;
  return stem
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function getCookieSid(setCookieHeader: string | null) {
  if (!setCookieHeader) {
    return undefined;
  }

  const match = setCookieHeader.match(/sid=([^;]+)/);
  return match?.[1];
}

export async function loginToErpNext(email: string, password: string): Promise<SessionData> {
  if (!baseUrl) {
    return {
      user: {
        email,
        displayName: getDisplayName(email)
      }
    };
  }

  const response = await fetch(`${baseUrl}/api/method/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      usr: email,
      pwd: password
    }).toString(),
    cache: "no-store"
  });

  const body = (await response.json().catch(() => ({}))) as { message?: string; exc?: string };

  if (!response.ok) {
    throw new Error(stringifyUnknown(body.message) || stringifyUnknown(body.exc) || "ERPNext login failed.");
  }

  const sid = getCookieSid(response.headers.get("set-cookie"));

  if (!sid && !(apiKey && apiSecret)) {
    throw new Error("ERPNext login succeeded but no session cookie was returned.");
  }

  return {
    user: {
      email,
      displayName: getDisplayName(email)
    },
    sid
  };
}

export function createSessionCookies(response: NextResponse, session: SessionData) {
  const encodedUser = encodeURIComponent(JSON.stringify(session.user));

  response.cookies.set("task_mobile_user", JSON.stringify(session.user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  response.cookies.set("task_mobile_user_encoded", encodedUser, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  response.cookies.set("task_mobile_authenticated", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  if (session.sid) {
    response.cookies.set("erpnext_sid", session.sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12
    });
  }
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set("task_mobile_user", "", { path: "/", maxAge: 0 });
  response.cookies.set("task_mobile_user_encoded", "", { path: "/", maxAge: 0 });
  response.cookies.set("task_mobile_authenticated", "", { path: "/", maxAge: 0 });
  response.cookies.set("erpnext_sid", "", { path: "/", maxAge: 0 });
}

export async function logoutFromErpNext(sid?: string) {
  if (!baseUrl || !sid) {
    return;
  }

  try {
    await fetch(`${baseUrl}/api/method/logout`, {
      method: "GET",
      headers: {
        Cookie: `sid=${sid}; system_user=yes`
      },
      cache: "no-store"
    });
  } catch {
    return;
  }
}

function getAuthHeaders(sid?: string): Record<string, string> {
  if (sid) {
    return {
      Cookie: `sid=${sid}; system_user=yes`
    };
  }

  if (apiKey && apiSecret) {
    return {
      Authorization: `token ${apiKey}:${apiSecret}`
    };
  }

  return {};
}

async function fetchMobileAppPayload(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...headers
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: unknown;
    exception?: string;
    exc?: string;
  };

  return { response, payload };
}

export async function callErpNextMobileApp(
  action: string,
  params: Record<string, string>,
  sid?: string
) {
  if (!baseUrl) {
    throw new Error("ERPNEXT_BASE_URL is not configured.");
  }

  const query = new URLSearchParams({ action });
  Object.entries(params).forEach(([key, value]) => {
    if (key !== "action" && value) {
      query.set(key, value);
    }
  });

  const url = `${baseUrl}/api/method/${methodName}?${query.toString()}`;
  let { response, payload } = await fetchMobileAppPayload(url, getAuthHeaders(sid));

  // Some ERPNext sessions can expire or lose permission context while API token access
  // still works. Retry once with token auth so the mobile app remains usable.
  if (!response.ok && sid && apiKey && apiSecret) {
    ({ response, payload } = await fetchMobileAppPayload(url, getAuthHeaders(undefined)));
  }

  if (!response.ok) {
    throw new Error(extractErpErrorMessage(payload));
  }

  return (payload.message as Record<string, unknown>) || payload;
}
