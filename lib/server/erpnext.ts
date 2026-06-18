import type { SessionUser } from "@/lib/session";
import { NextResponse } from "next/server";

const baseUrl = process.env.ERPNEXT_BASE_URL?.replace(/\/$/, "");
const methodName = process.env.ERPNEXT_SERVER_SCRIPT_METHOD || "task_mobile_app_api";
const partnerCalendarMethodName =
  process.env.ERPNEXT_PARTNER_CALENDAR_METHOD || "partners_calendar_mobile_api";
const apiKey = process.env.ERPNEXT_API_KEY;
const apiSecret = process.env.ERPNEXT_API_SECRET;
const partnerCalendarRoleName = process.env.ERPNEXT_PARTNER_CALENDAR_ROLE?.trim() || "";

export type SessionData = {
  user: {
    email: string;
    displayName: string;
    roles?: string[];
    isPartnerCalendarUser?: boolean;
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

function normalizeRole(value: string) {
  return value.trim().toLowerCase();
}

function hasPartnerCalendarRole(roles?: string[]) {
  if (!partnerCalendarRoleName || !Array.isArray(roles) || roles.length === 0) {
    return false;
  }

  const normalizedTarget = normalizeRole(partnerCalendarRoleName);
  return roles.some((role) => normalizeRole(role || "") === normalizedTarget);
}

function getCookieSid(setCookieHeader: string | null) {
  if (!setCookieHeader) {
    return undefined;
  }

  const match = setCookieHeader.match(/sid=([^;]+)/);
  return match?.[1];
}

async function fetchErpNextUserFullName(email: string, sid?: string) {
  if (!baseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/api/resource/User/${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getAuthHeaders(sid)
      },
      cache: "no-store"
    });

    if (!response.ok && sid && apiKey && apiSecret) {
      return fetchErpNextUserFullName(email);
    }

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      data?: {
        full_name?: string;
      };
    };

    return payload.data?.full_name?.trim() || null;
  } catch {
    return null;
  }
}

async function fetchErpNextUserRoles(email: string, sid?: string) {
  if (!baseUrl) {
    return [];
  }

  const extractRolesFromUserDoc = (payload: {
    data?: {
      roles?: Array<{ role?: string }>;
    };
  }) => {
    return (payload.data?.roles || []).map((item) => item.role?.trim() || "").filter(Boolean);
  };

  const fetchRolesFromUserDoc = async (headers: Record<string, string>) => {
    const response = await fetch(`${baseUrl}/api/resource/User/${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...headers
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json().catch(() => ({}))) as {
      data?: {
        roles?: Array<{ role?: string }>;
      };
    };

    return extractRolesFromUserDoc(payload);
  };

  try {
    const filters = encodeURIComponent(JSON.stringify([["parent", "=", email], ["parenttype", "=", "User"]]));
    const fields = encodeURIComponent(JSON.stringify(["role"]));
    const response = await fetch(`${baseUrl}/api/resource/Has Role?filters=${filters}&fields=${fields}&limit_page_length=200`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getAuthHeaders(sid)
      },
      cache: "no-store"
    });

    if (!response.ok && sid && apiKey && apiSecret) {
      return fetchErpNextUserRoles(email);
    }

    if (response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        data?: Array<{ role?: string }>;
      };

      const directRoles = (payload.data || []).map((item) => item.role?.trim() || "").filter(Boolean);
      if (directRoles.length > 0) {
        return directRoles;
      }
    }

    const fallbackRoles = await fetchRolesFromUserDoc(getAuthHeaders(sid));
    if (fallbackRoles.length > 0) {
      return fallbackRoles;
    }

    if (sid && apiKey && apiSecret) {
      return fetchRolesFromUserDoc(getAuthHeaders(undefined));
    }

    return [];
  } catch {
    try {
      const fallbackRoles = await fetchRolesFromUserDoc(getAuthHeaders(sid));
      if (fallbackRoles.length > 0) {
        return fallbackRoles;
      }

      if (sid && apiKey && apiSecret) {
        return fetchRolesFromUserDoc(getAuthHeaders(undefined));
      }
    } catch {
      return [];
    }

    return [];
  }
}

async function fetchManagementUserEmails(sid?: string) {
  if (!baseUrl) {
    return [];
  }

  const url = `${baseUrl}/api/method/${partnerCalendarMethodName}?action=management_users`;

  try {
    let { response, payload } = await fetchMobileAppPayload(url, getAuthHeaders(sid));

    if (!response.ok && sid && apiKey && apiSecret) {
      ({ response, payload } = await fetchMobileAppPayload(url, getAuthHeaders(undefined)));
    }

    if (!response.ok) {
      return [];
    }

    const message = (payload.message as { data?: { users?: Array<{ value?: string }> } } | undefined) ?? {};
    return (message.data?.users || [])
      .map((item) => item.value?.trim().toLowerCase() || "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function resolvePartnerCalendarAccess(email: string, roles?: string[], sid?: string) {
  if (hasPartnerCalendarRole(roles)) {
    return true;
  }

  const managementUserEmails = await fetchManagementUserEmails(sid);
  return managementUserEmails.includes(email.trim().toLowerCase());
}

export async function loginToErpNext(email: string, password: string): Promise<SessionData> {
  if (!baseUrl) {
    const roles: string[] = [];
    return {
      user: {
        email,
        displayName: getDisplayName(email),
        roles,
        isPartnerCalendarUser: false
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
  const displayName = (await fetchErpNextUserFullName(email, sid)) || getDisplayName(email);
  const roles = await fetchErpNextUserRoles(email, sid);

  if (!sid && !(apiKey && apiSecret)) {
    throw new Error("ERPNext login succeeded but no session cookie was returned.");
  }

  return {
    user: {
      email,
      displayName,
      roles,
      isPartnerCalendarUser: await resolvePartnerCalendarAccess(email, roles, sid)
    },
    sid
  };
}

export async function hydrateSessionUser(user?: SessionUser | null, sid?: string) {
  if (!user?.email) {
    return user ?? null;
  }

  const roles = await fetchErpNextUserRoles(user.email, sid);
  const nextRoles = roles.length > 0 ? roles : user.roles || [];
  const displayName = (await fetchErpNextUserFullName(user.email, sid)) || user.displayName || getDisplayName(user.email);
  const isManagementUser = await resolvePartnerCalendarAccess(user.email, nextRoles, sid);
  const shouldPreserveManagementMode = roles.length === 0 && user.isPartnerCalendarUser === true;

  return {
    ...user,
    displayName,
    roles: nextRoles,
    isPartnerCalendarUser: shouldPreserveManagementMode ? true : isManagementUser
  } satisfies SessionUser;
}

export async function getResolvedSessionUser(user?: SessionUser | null, sid?: string) {
  if (!user) {
    return null;
  }

  const hasDisplayName = Boolean(user.displayName?.trim());
  const hasRoleData = Array.isArray(user.roles) && user.roles.length > 0;
  const hasPartnerCalendarFlag = typeof user.isPartnerCalendarUser === "boolean";

  if (hasDisplayName && (hasRoleData || hasPartnerCalendarFlag)) {
    return user;
  }

  return hydrateSessionUser(user, sid);
}

export function createSessionCookies(response: NextResponse, session: SessionData) {
  const encodedUser = encodeURIComponent(JSON.stringify(session.user));

  response.cookies.set("task_mobile_user", encodedUser, {
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    await fetch(`${baseUrl}/api/method/logout`, {
      method: "GET",
      headers: {
        Cookie: `sid=${sid}; system_user=yes`
      },
      cache: "no-store",
      signal: controller.signal
    });
  } catch {
    return;
  } finally {
    clearTimeout(timeout);
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

  // Only retry with API token when the failure is a genuine session/auth problem,
  // not when our script returned an application-level error (success: false in message).
  // Retrying on app errors re-runs the request as a different admin user, which causes
  // ownership checks to fail with misleading "Access denied" errors.
  const appMessage = payload.message as Record<string, unknown> | undefined;
  const isAppError = appMessage && typeof appMessage === "object" && appMessage.success === false;

  if (!response.ok && !isAppError && sid && apiKey && apiSecret) {
    ({ response, payload } = await fetchMobileAppPayload(url, getAuthHeaders(undefined)));
  }

  if (!response.ok) {
    throw new Error(extractErpErrorMessage(payload));
  }

  return (payload.message as Record<string, unknown>) || payload;
}

export async function callErpNextPartnerCalendarApp(
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

  const url = `${baseUrl}/api/method/${partnerCalendarMethodName}?${query.toString()}`;
  let { response, payload } = await fetchMobileAppPayload(url, getAuthHeaders(sid));

  const appMessage = payload.message as Record<string, unknown> | undefined;
  const isAppError = appMessage && typeof appMessage === "object" && appMessage.success === false;

  if (!response.ok && !isAppError && sid && apiKey && apiSecret) {
    ({ response, payload } = await fetchMobileAppPayload(url, getAuthHeaders(undefined)));
  }

  if (!response.ok) {
    throw new Error(extractErpErrorMessage(payload));
  }

  return (payload.message as Record<string, unknown>) || payload;
}

export async function fetchErpNextResourceList(
  doctype: string,
  options?: {
    fields?: string[];
    filters?: Record<string, string | number>;
    orderBy?: string;
    sid?: string;
  }
) {
  if (!baseUrl) {
    throw new Error("ERPNEXT_BASE_URL is not configured.");
  }

  const query = new URLSearchParams();
  query.set("limit_page_length", "0");

  if (options?.fields?.length) {
    query.set("fields", JSON.stringify(options.fields));
  }

  if (options?.filters && Object.keys(options.filters).length > 0) {
    query.set("filters", JSON.stringify(options.filters));
  }

  if (options?.orderBy) {
    query.set("order_by", options.orderBy);
  }

  const url = `${baseUrl}/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`;
  let response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(options?.sid)
    },
    cache: "no-store"
  });

  if (!response.ok && options?.sid && apiKey && apiSecret) {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getAuthHeaders(undefined)
      },
      cache: "no-store"
    });
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Array<Record<string, unknown>>;
    message?: unknown;
    exception?: string;
    exc?: string;
  };

  if (!response.ok) {
    throw new Error(extractErpErrorMessage(payload));
  }

  return payload.data ?? [];
}

export async function fetchErpNextResourceDoc(
  doctype: string,
  name: string,
  sid?: string
) {
  if (!baseUrl) {
    throw new Error("ERPNEXT_BASE_URL is not configured.");
  }

  const url = `${baseUrl}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
  let response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(sid)
    },
    cache: "no-store"
  });

  if (!response.ok && sid && apiKey && apiSecret) {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...getAuthHeaders(undefined)
      },
      cache: "no-store"
    });
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    message?: unknown;
    exception?: string;
    exc?: string;
  };

  if (!response.ok) {
    throw new Error(extractErpErrorMessage(payload));
  }

  return payload.data ?? {};
}

export async function updateErpNextResourceDoc(
  doctype: string,
  name: string,
  values: Record<string, unknown>,
  sid?: string
) {
  if (!baseUrl) {
    throw new Error("ERPNEXT_BASE_URL is not configured.");
  }

  const url = `${baseUrl}/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`;
  const attempt = async (headers: Record<string, string>) => {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(values),
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => ({}))) as {
      data?: Record<string, unknown>;
      message?: unknown;
      exception?: string;
      exc?: string;
    };

    if (!response.ok) {
      throw new Error(extractErpErrorMessage(payload));
    }

    return payload.data ?? {};
  };

  try {
    return await attempt(getAuthHeaders(sid));
  } catch (error) {
    if (sid && apiKey && apiSecret) {
      return attempt(getAuthHeaders(undefined));
    }
    throw error;
  }
}
