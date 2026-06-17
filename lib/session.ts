export type SessionUser = {
  email?: string;
  displayName?: string;
  roles?: string[];
  isPartnerCalendarUser?: boolean;
};

type CookieValue = {
  value: string;
};

type CookieReader = {
  get(name: string): CookieValue | undefined;
};

export function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseSessionUser(cookieValue?: string) {
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

export function readSessionUser(cookieStore: CookieReader) {
  return (
    parseSessionUser(cookieStore.get("task_mobile_user")?.value) ??
    parseSessionUser(
      cookieStore.get("task_mobile_user_encoded")?.value
        ? safeDecodeURIComponent(cookieStore.get("task_mobile_user_encoded")!.value)
        : undefined
    )
  );
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase();
}

export function getPartnerCalendarRoleName() {
  return process.env.ERPNEXT_PARTNER_CALENDAR_ROLE?.trim() || "";
}

export function hasPartnerCalendarRole(roles?: string[]) {
  const targetRole = getPartnerCalendarRoleName();
  if (!targetRole || !Array.isArray(roles) || roles.length === 0) {
    return false;
  }

  const normalizedTarget = normalizeRole(targetRole);
  return roles.some((role) => normalizeRole(role || "") === normalizedTarget);
}

export function isPartnerCalendarUser(user?: SessionUser | null) {
  if (!user) {
    return false;
  }

  if (user.isPartnerCalendarUser === true) {
    return true;
  }

  return hasPartnerCalendarRole(user.roles);
}
