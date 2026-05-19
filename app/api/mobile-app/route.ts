import { callErpNextMobileApp } from "@/lib/server/erpnext";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function normalizeTimeZone(value?: string) {
  const candidate = value?.trim().replace(/^:+/, "");
  if (!candidate) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return null;
  }
}

const ERP_TIME_ZONE =
  normalizeTimeZone(process.env.ERPNEXT_TIMEZONE) ??
  normalizeTimeZone(process.env.TZ) ??
  "UTC";

function toCamelCaseKey(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeKeys(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        toCamelCaseKey(key),
        normalizeKeys(nestedValue)
      ])
    ) as T;
  }

  return value;
}

function parseNaiveDateTime(value: string) {
  const match = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "0", fraction = "0"] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
    millisecond: Number(fraction.padEnd(3, "0"))
  };
}

function hasExplicitTimezone(value: string) {
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value.trim());
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );

  return asUtc - date.getTime();
}

function toUtcIso(value: string, timeZone: string) {
  if (hasExplicitTimezone(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const parts = parseNaiveDateTime(value);
  if (!parts) {
    return null;
  }

  const guess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );

  let resolved = guess - getTimeZoneOffsetMilliseconds(new Date(guess), timeZone);
  const corrected = guess - getTimeZoneOffsetMilliseconds(new Date(resolved), timeZone);
  if (corrected !== resolved) {
    resolved = corrected;
  }

  return new Date(resolved).toISOString();
}

function attachUtcDateTimes<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => attachUtcDateTimes(item)) as T;
  }

  if (value && typeof value === "object") {
    const next = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, attachUtcDateTimes(nested)])
    ) as Record<string, unknown>;

    if (typeof next.fromTime === "string" && !next.fromTimeUtc) {
      next.fromTimeUtc = toUtcIso(next.fromTime, ERP_TIME_ZONE);
    }

    if (typeof next.toTime === "string" && !next.toTimeUtc) {
      next.toTimeUtc = toUtcIso(next.toTime, ERP_TIME_ZONE);
    }

    return next as T;
  }

  return value;
}

type SessionUser = {
  email?: string;
  displayName?: string;
};

type OwnershipCandidate = {
  owner?: unknown;
  userId?: unknown;
  employee?: unknown;
  employeeId?: unknown;
  employeeName?: unknown;
  createdBy?: unknown;
  createdByEmail?: unknown;
  createdByUser?: unknown;
  createdByUserId?: unknown;
};

function parseSessionUser(cookieValue?: string) {
  if (!cookieValue) {
    return null;
  }

  try {
    return JSON.parse(cookieValue) as SessionUser;
  } catch {
    try {
      return JSON.parse(safeDecodeURIComponent(cookieValue)) as SessionUser;
    } catch {
      return null;
    }
  }
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeMatchValue(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesSessionUser(entry: OwnershipCandidate, user: SessionUser) {
  const userTokens = [
    user.email,
    user.displayName
  ]
    .map(normalizeMatchValue)
    .filter(Boolean);

  if (userTokens.length === 0) {
    return null;
  }

  const ownerTokens = [
    entry.owner,
    entry.userId,
    entry.employee,
    entry.employeeId,
    entry.employeeName,
    entry.createdBy,
    entry.createdByEmail,
    entry.createdByUser,
    entry.createdByUserId
  ]
    .map(normalizeMatchValue)
    .filter(Boolean);

  if (ownerTokens.length === 0) {
    return null;
  }

  return ownerTokens.some((token) => userTokens.includes(token));
}

function filterUserOwnedEntries<T>(entries: T[] | undefined, user: SessionUser) {
  if (!Array.isArray(entries)) {
    return entries;
  }

  const matches = entries.filter((entry) => matchesSessionUser((entry || {}) as OwnershipCandidate, user) === true);
  const hasOwnershipSignals = entries.some((entry) => matchesSessionUser((entry || {}) as OwnershipCandidate, user) !== null);

  return hasOwnershipSignals ? matches : entries;
}

function filterUserOwnedRunningTimer<T>(entry: T | null | undefined, user: SessionUser) {
  if (!entry || typeof entry !== "object") {
    return entry ?? null;
  }

  const match = matchesSessionUser(entry as OwnershipCandidate, user);
  if (match === null) {
    return entry;
  }

  return match ? entry : null;
}

function filterPayloadForCurrentUser(action: string, payload: Record<string, unknown>, user: SessionUser | null) {
  if (!user) {
    return payload;
  }

  const data = payload.data;
  if (!data || typeof data !== "object") {
    return payload;
  }

  const nextData = { ...(data as Record<string, unknown>) };
  nextData.serverNowUtc = new Date().toISOString();

  if (action === "overview" || action === "timesheets") {
    nextData.runningTimer = filterUserOwnedRunningTimer(nextData.runningTimer, user);
    nextData.timesheets = filterUserOwnedEntries(nextData.timesheets as Array<Record<string, unknown>> | undefined, user);
    nextData.recentClientVisits = filterUserOwnedEntries(
      nextData.recentClientVisits as Array<Record<string, unknown>> | undefined,
      user
    );

    if (action === "timesheets" && Array.isArray(nextData.timesheets)) {
      const timesheets = nextData.timesheets as Array<Record<string, unknown>>;
      nextData.summary = {
        entries: timesheets.length,
        completedEntries: timesheets.filter((entry) => !entry.isRunning).length,
        totalHours: Number(
          timesheets
            .filter((entry) => !entry.isRunning)
            .reduce((total, entry) => total + (typeof entry.hours === "number" ? entry.hours : 0), 0)
            .toFixed(2)
        )
      };
    }
  }

  return {
    ...payload,
    data: nextData
  };
}

async function getRequestParams(request: NextRequest) {
  if (request.method === "GET") {
    return Object.fromEntries(request.nextUrl.searchParams.entries());
  }

  try {
    return (await request.json()) as Record<string, string>;
  } catch {
    return {};
  }
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return "ERPNext request could not be completed.";
}

function isUnsupportedActivityTypesError(action: string, error: unknown) {
  if (action !== "activity_types") {
    return false;
  }

  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("unsupported action") && message.includes("activity_types");
}

async function handleRequest(request: NextRequest) {
  const params = await getRequestParams(request);
  const action = params.action;

  if (!action) {
    return NextResponse.json(
      {
        success: false,
        action: null,
        data: null,
        error: "action is required"
      },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get("erpnext_sid")?.value;
  const currentUser =
    parseSessionUser(cookieStore.get("task_mobile_user")?.value) ??
    parseSessionUser(
      cookieStore.get("task_mobile_user_encoded")?.value
        ? safeDecodeURIComponent(cookieStore.get("task_mobile_user_encoded")!.value)
        : undefined
    );

  if (!process.env.ERPNEXT_BASE_URL) {
    return NextResponse.json(
      {
        success: false,
        action,
        data: null,
        error: "ERPNEXT_BASE_URL is not configured."
      },
      { status: 500 }
    );
  }

  try {
    const payload = await callErpNextMobileApp(action, params, sid);
    const normalizedPayload = attachUtcDateTimes(normalizeKeys(payload)) as Record<string, unknown>;
    const filteredPayload = filterPayloadForCurrentUser(action, normalizedPayload, currentUser);

    return NextResponse.json(filteredPayload, {
      status: payload.success ? 200 : 400
    });
  } catch (error) {
    if (isUnsupportedActivityTypesError(action, error)) {
      return NextResponse.json({
        success: true,
        action,
        data: {
          activityTypes: ["Working"]
        },
        error: null
      });
    }

    const errMsg = formatErrorMessage(error);
    return NextResponse.json(
      {
        success: false,
        action,
        data: null,
        error: errMsg
      },
      { status: errMsg ? 400 : 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
